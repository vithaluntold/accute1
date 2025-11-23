# File Upload Security Assessment - CORRECTED
**Date**: 2025-11-15  
**Priority**: MEDIUM  
**Status**: Baseline protections exist, 2 enhancements needed

## Executive Summary

**CORRECTED ASSESSMENT**: The global Multer configuration provides **strong baseline security** for all file upload endpoints:
- ✅ MIME type whitelist enforced globally
- ✅ File extension whitelist enforced globally  
- ✅ 50MB file size limit enforced globally
- ✅ Filename sanitization prevents path traversal

**Only 2 genuine gaps remain**:
1. **MIME Header Spoofing Risk** (MEDIUM) - No magic-byte validation to verify file content matches declared MIME type
2. **Bulk Upload Storage Risk** (MEDIUM) - No aggregate size limit for bulk uploads (currently 10 × 50MB = 500MB possible)

---

## Current Protection Analysis

### ✅ Global Multer Middleware (Lines 108-142)

**ALL endpoints inherit these protections** because they use the shared `upload` instance:

```typescript
const upload = multer({
  storage: multer.diskStorage({
    filename: (req, file, cb) => {
      // ✅ Sanitizes filename, prevents path traversal
      const sanitizedOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = path.extname(sanitizedOriginalName).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(16).toString('hex');
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // ✅ 50MB limit enforced globally
  },
  fileFilter: (req, file, cb) => {
    // ✅ Validates MIME type against whitelist
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type`));
    }
    
    // ✅ Validates file extension against whitelist
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Invalid file extension`));
    }
    
    cb(null, true);
  }
});
```

**Protected File Types** (Whitelisted):
- Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- Text: TXT, CSV
- Images: PNG, JPG, JPEG, GIF, WebP

**Blocked File Types** (Rejected by Multer):
- Executables: .exe, .sh, .bat, .cmd
- Scripts: .js, .py, .php, .rb
- Archives: .zip, .tar, .gz (not in whitelist)
- Any unlisted extension/MIME type

---

## Actual Vulnerabilities (Only 2)

### 1. MIME Header Spoofing Risk
**Severity**: MEDIUM  
**Location**: All 5 upload endpoints

**Issue**:
- Multer validates `file.mimetype` header sent by client
- Attacker can spoof MIME header (claim .exe is application/pdf)
- No magic-byte validation to verify actual file content

**Example Attack**:
```bash
# Create malicious file
echo "#!/bin/bash\nrm -rf /" > malware.sh

# Upload with spoofed MIME header
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "file=@malware.sh;type=application/pdf" \
  https://api.accute.com/api/documents
```

**Mitigation**:
```typescript
// Add magic-byte validation after upload
import { fileTypeFromBuffer } from 'file-type';

async function validateMagicBytes(filePath: string, claimedMime: string): Promise<boolean> {
  const buffer = fs.readFileSync(filePath);
  const detectedType = await fileTypeFromBuffer(buffer);
  
  if (!detectedType || detectedType.mime !== claimedMime) {
    return false; // File content doesn't match claimed type
  }
  
  return true;
}
```

---

### 2. Bulk Upload Storage Exhaustion
**Severity**: MEDIUM  
**Location**: `/api/client-portal/documents/upload` (Line 7862)

**Issue**:
- Endpoint accepts up to 10 files via `upload.array("files", 10)`
- Each file can be 50MB (Multer limit)
- **No aggregate limit**: 10 × 50MB = 500MB in single request
- Could exhaust storage with repeated bulk uploads

**Current Code** (No Aggregate Check):
```typescript
app.post("/api/client-portal/documents/upload", requireAuth, requirePermission("documents.upload"), 
  upload.array("files", 10), async (req: AuthRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    // ❌ NO AGGREGATE SIZE CHECK
    // Process files...
  }
);
```

**Mitigation**:
```typescript
const MAX_BULK_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

app.post("/api/client-portal/documents/upload", requireAuth, requirePermission("documents.upload"), 
  upload.array("files", 10), async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      // ✅ Check aggregate size
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_BULK_TOTAL_SIZE) {
        // Clean up all uploaded files
        files.forEach(f => {
          if (fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        });
        return res.status(400).json({ 
          error: `Total upload size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed (100MB)` 
        });
      }

      // Continue processing...
    } catch (error: any) {
      // Clean up on error
      if (req.files) {
        (req.files as Express.Multer.File[]).forEach(f => {
          if (fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        });
      }
      res.status(500).json({ error: "Upload failed" });
    }
  }
);
```

---

## Recommended Enhancements

### Enhancement 1: Add Magic-Byte Validation

**Install library**:
```bash
npm install file-type
```

**Create validation helper** (`server/file-validation.ts`):
```typescript
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs';

export async function validateFileContent(filePath: string, expectedMimeType: string): Promise<boolean> {
  try {
    const buffer = fs.readFileSync(filePath);
    const detectedType = await fileTypeFromBuffer(buffer);
    
    if (!detectedType) {
      console.warn(`Unable to detect file type for: ${filePath}`);
      return false;
    }

    // Check if detected MIME matches claimed MIME
    const matches = detectedType.mime === expectedMimeType;
    if (!matches) {
      console.warn(`MIME mismatch: claimed ${expectedMimeType}, detected ${detectedType.mime}`);
    }
    
    return matches;
  } catch (error) {
    console.error(`Magic byte validation error:`, error);
    return false;
  }
}
```

**Apply to sensitive endpoints** (Avatar, KYC, Documents):
```typescript
app.post("/api/users/me/avatar", requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('avatar')(req, res, async (err) => {
    try {
      if (err || !req.file) {
        return res.status(400).json({ error: err?.message || "No file uploaded" });
      }

      // ✅ Validate magic bytes
      const { validateFileContent } = await import('./file-validation');
      const isValid = await validateFileContent(req.file.path, req.file.mimetype);
      
      if (!isValid) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File content does not match declared type" });
      }

      // Continue with avatar upload...
    } catch (error: any) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: "Upload failed" });
    }
  });
});
```

---

### Enhancement 2: Add Bulk Upload Aggregate Limit

**Implementation**: See code example in Vulnerability #2 above.

**Configuration**:
- Suggested aggregate limit: 100MB (for 10 files)
- Individual file limit remains: 50MB (Multer global)
- Ensures no single request exceeds reasonable total size

---

## Implementation Checklist

- [ ] Install `file-type` library (`npm install file-type`)
- [ ] Create `server/file-validation.ts` helper
- [ ] Add magic-byte validation to Avatar upload
- [ ] Add magic-byte validation to KYC document upload
- [ ] Add magic-byte validation to Documents upload
- [ ] Add aggregate size check to bulk upload endpoint
- [ ] Add proper cleanup on validation failures
- [ ] Test MIME spoofing attack scenarios
- [ ] Test bulk upload aggregate limits

---

## Testing Strategy

### Test 1: MIME Spoofing Attack
```bash
# Create shell script
echo "#!/bin/bash\necho 'malware'" > malware.sh

# Try to upload with spoofed PDF MIME type
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "file=@malware.sh;type=application/pdf" \
  https://api.accute.com/api/documents

# Expected: 400 Bad Request - "File content does not match declared type"
```

### Test 2: Bulk Upload Size Limit
```bash
# Upload 10 × 15MB files = 150MB (exceeds 100MB aggregate limit)
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "files=@file1-15MB.pdf" \
  -F "files=@file2-15MB.pdf" \
  ... (10 files)
  https://api.accute.com/api/client-portal/documents/upload

# Expected: 400 Bad Request - "Total upload size exceeds maximum allowed"
```

---

## Summary

**Current State**: ✅ Strong baseline protections (MIME/extension whitelist, 50MB limit)

**Needed Enhancements**:
1. Magic-byte validation (prevents MIME spoofing)
2. Aggregate size limits for bulk uploads (prevents storage exhaustion)

**Priority**: MEDIUM (baseline protections mitigate most attacks)

**Estimated Effort**: 2-3 hours total

**Risk if Unaddressed**: 
- MIME spoofing: Malicious files could bypass content-type checks
- Bulk storage: Repeated large uploads could exhaust disk space

