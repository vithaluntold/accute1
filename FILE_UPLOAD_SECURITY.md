# File Upload Security Audit Report
**Date**: 2025-11-15  
**Priority**: 🚨 HIGH  
**Impact**: Malicious File Upload, RCE, Storage Exhaustion

## Executive Summary

**UPDATED ASSESSMENT (2025-11-15)**: After re-audit, the global Multer configuration **IS secure** with proper whitelist enforcement and 50MB size limits. However, **3 medium-severity gaps remain**:

1. **MIME Type Spoofing Risk** (No magic-byte validation)
2. **Bulk Upload Storage Risk** (No aggregate limits for bulk uploads)
3. **Missing Post-Upload Validation** (No content verification after upload)

The platform has ✅ **strong baseline protections** but needs magic-byte validation to prevent MIME header spoofing attacks.

### Impact Assessment (Revised)
- **Severity**: MEDIUM (down from HIGH due to existing protections)
- **Affected Endpoints**: All 5 file upload endpoints vulnerable to MIME spoofing
- **Exploit Difficulty**: Medium (requires MIME header manipulation)
- **Data Exposure**: Limited (whitelists block most attacks)
- **Compliance Risk**: OWASP A03:2021 (Injection) - partially mitigated

## Vulnerability Details

### Global Configuration Analysis - ✅ MOSTLY SECURE

**Location**: `server/routes.ts` Lines 84-142

**Current Multer Configuration** (✅ HAS PROTECTIONS):
```typescript
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // ✅ GOOD: Sanitize filename
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
    // ✅ GOOD: Validate MIME type against whitelist
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
    
    // ✅ GOOD: Validate file extension against whitelist
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
    
    cb(null, true);
  }
});
```

**✅ POSITIVE FINDINGS**:
- Global 50MB file size limit enforced
- MIME type whitelist enforced in fileFilter
- Extension whitelist enforced in fileFilter
- Filename sanitization prevents path traversal

**⚠️ REMAINING GAPS**:
1. **No magic-byte validation** - Relies on user-provided MIME type header (can be spoofed)
2. **No endpoint-specific size limits** - All endpoints use same 50MB limit (KYC should be smaller)
3. **No bulk upload aggregate limits** - Can upload 10 × 50MB = 500MB in one request
4. **No post-upload content validation** - File content not verified after upload

---

### 1. Avatar Upload - Inconsistent Validation
**Location**: `server/routes.ts` Line 1726  
**Endpoint**: `POST /api/users/me/avatar`  
**Severity**: MEDIUM (has some validation but could be bypassed)

**Current Code**:
```typescript
app.post("/api/users/me/avatar", requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('avatar')(req, res, async (err) => {
    // ... error handling ...
    
    // ✅ GOOD: Validates file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Invalid file type" });
    }

    // ✅ GOOD: Validates file size
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "File too large" });
    }
  });
});
```

**Issues**:
- ⚠️ MIME type can be spoofed (needs magic byte validation)
- ⚠️ No extension validation (file.jpg could contain executable)
- ✅ Has size limit (5MB)
- ✅ Has MIME type check

**Risk**: MEDIUM - Attacker could upload malicious image files (e.g., JPEG with embedded script)

---

### 2. KYC Document Upload - NO VALIDATION
**Location**: `server/routes.ts` Line 1801  
**Endpoint**: `POST /api/users/me/kyc/documents`  
**Severity**: 🚨 CRITICAL

**Vulnerable Code**:
```typescript
app.post("/api/users/me/kyc/documents", requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('document')(req, res, async (err) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const documentType = req.body.documentType;
    if (!documentType || !['idDocument', 'addressProof'].includes(documentType)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Invalid document type" });
    }

    // ❌ NO MIME TYPE VALIDATION
    // ❌ NO FILE SIZE VALIDATION
    // ❌ NO EXTENSION VALIDATION
    
    const relativePath = `/uploads/${req.file.filename}`;
    // ... saves file ...
  });
});
```

**Exploit**:
```bash
# Upload executable file as KYC document
curl -X POST -H "Authorization: Bearer <token>" \
  -F "document=@malware.exe" \
  -F "documentType=idDocument" \
  https://api.accute.com/api/users/me/kyc/documents
```

**Risk**: 🚨 CRITICAL
- Unlimited file size (storage exhaustion)
- Any file type accepted (executables, scripts)
- Could bypass KYC verification

---

### 3. General Document Upload - NO ENDPOINT VALIDATION
**Location**: `server/routes.ts` Line 4690  
**Endpoint**: `POST /api/documents`  
**Severity**: 🚨 HIGH

**Vulnerable Code**:
```typescript
app.post("/api/documents", requireAuth, requirePermission("documents.upload"), 
  upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // ❌ NO MIME TYPE VALIDATION (relies on undefined Multer config)
      // ❌ NO FILE SIZE VALIDATION (no limits in Multer)
      // ❌ NO EXTENSION VALIDATION

      const fileBuffer = fs.readFileSync(req.file.path);
      const documentHash = cryptoUtils.generateDocumentHash(fileBuffer);
      const digitalSignature = await cryptoUtils.signDocumentHash(documentHash, req.user!.organizationId!);

      const documentData = {
        name: req.body.name || req.file.originalname,
        type: req.file.mimetype, // ⚠️ SPOOFABLE
        size: req.file.size,     // ⚠️ UNLIMITED
        url: `/uploads/${req.file.filename}`,
        // ... PKI signature fields ...
      };

      const document = await storage.createDocument(documentData);
      res.json(document);
    }
  }
);
```

**Exploit**:
```bash
# Upload 1GB executable file
curl -X POST -H "Authorization: Bearer <token>" \
  -F "file=@huge-malware.bin" \
  https://api.accute.com/api/documents
```

**Risk**: 🚨 HIGH
- Unlimited file size (can exhaust storage)
- Any file type accepted
- ✅ Has PKI signature (good for integrity, but doesn't prevent upload)

---

### 4. Document Version Upload - NO VALIDATION
**Location**: `server/routes.ts` Line 4980  
**Endpoint**: `POST /api/documents/:id/versions`  
**Severity**: 🚨 HIGH

**Vulnerable Code**:
```typescript
app.post("/api/documents/:id/versions", requireAuth, requirePermission("documents.upload"), 
  upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // ❌ NO MIME TYPE VALIDATION
      // ❌ NO FILE SIZE VALIDATION
      // ❌ NO EXTENSION VALIDATION
      
      const crypto = await import('crypto');
      const documentHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      // ... saves version ...
    }
  }
);
```

**Risk**: 🚨 HIGH
- Can upload any file as document version
- Unlimited versioning storage consumption

---

### 5. Client Portal Bulk Upload - NO VALIDATION
**Location**: `server/routes.ts` Line 7862  
**Endpoint**: `POST /api/client-portal/documents/upload`  
**Severity**: 🚨 CRITICAL (bulk upload amplifies risk)

**Vulnerable Code**:
```typescript
app.post("/api/client-portal/documents/upload", requireAuth, requirePermission("documents.upload"), 
  upload.array("files", 10), async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      // ❌ NO MIME TYPE VALIDATION FOR BULK UPLOADS
      // ❌ NO FILE SIZE VALIDATION
      // ❌ NO TOTAL SIZE LIMIT (10 files × unlimited = ∞)
      
      // Process uploaded files...
    }
  }
);
```

**Exploit**:
```bash
# Upload 10 × 1GB files = 10GB attack
curl -X POST -H "Authorization: Bearer <token>" \
  -F "files=@1gb-file1.bin" \
  -F "files=@1gb-file2.bin" \
  ... (10 files)
  https://api.accute.com/api/client-portal/documents/upload
```

**Risk**: 🚨 CRITICAL
- **10x amplification** of storage exhaustion attack
- No validation on individual files
- No total upload size limit

---

## Recommended Fixes

### Fix 1: Enforce Whitelists in Multer Configuration

```typescript
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const sanitizedOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = path.extname(sanitizedOriginalName).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(16).toString('hex');
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  }),
  // ✅ ADD SECURITY LIMITS
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 10, // Max 10 files for array uploads
  },
  // ✅ ADD WHITELIST ENFORCEMENT
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    // Check extension whitelist
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`File extension ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }

    // Check MIME type whitelist
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return cb(new Error(`File type ${mimeType} not allowed`));
    }

    // ✅ PASS validation
    cb(null, true);
  }
});
```

---

### Fix 2: Add Magic Byte Validation Library

Install `file-type` for magic byte detection:
```bash
npm install file-type
```

Create validation utility:
```typescript
// server/file-validation.ts
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs';

export async function validateFileContent(filePath: string, expectedMimeType: string): Promise<boolean> {
  const buffer = fs.readFileSync(filePath);
  const detectedType = await fileTypeFromBuffer(buffer);
  
  if (!detectedType) {
    return false; // Unknown file type
  }

  // Verify detected MIME type matches claimed MIME type
  return detectedType.mime === expectedMimeType;
}

export async function validateImage(filePath: string): Promise<boolean> {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const buffer = fs.readFileSync(filePath);
  const detectedType = await fileTypeFromBuffer(buffer);
  
  if (!detectedType) {
    return false;
  }

  return allowedImageTypes.includes(detectedType.mime);
}
```

---

### Fix 3: Enhanced Avatar Upload with Magic Byte Validation

```typescript
app.post("/api/users/me/avatar", requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('avatar')(req, res, async (err) => {
    try {
      if (err) {
        console.error("Avatar upload error:", err);
        return res.status(400).json({ error: err.message || "File upload failed" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // ✅ LAYER 1: Validate file extension
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid file extension" });
      }

      // ✅ LAYER 2: Validate claimed MIME type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid file type" });
      }

      // ✅ LAYER 3: Validate actual file content (magic bytes)
      const { validateImage } = await import('./file-validation');
      const isValidImage = await validateImage(req.file.path);
      if (!isValidImage) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File content does not match image format" });
      }

      // ✅ LAYER 4: Validate file size (already done by Multer limits)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File too large. Maximum size is 5MB" });
      }

      // ... rest of upload logic ...
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });
});
```

---

### Fix 4: Add Validation to KYC Document Upload

```typescript
app.post("/api/users/me/kyc/documents", requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('document')(req, res, async (err) => {
    try {
      if (err) {
        console.error("KYC document upload error:", err);
        return res.status(400).json({ error: err.message || "File upload failed" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const documentType = req.body.documentType;
      if (!documentType || !['idDocument', 'addressProof'].includes(documentType)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid document type" });
      }

      // ✅ ADD: Validate file extension
      const ext = path.extname(req.file.originalname).toLowerCase();
      const allowedKycExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
      if (!allowedKycExtensions.includes(ext)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: `Invalid file extension. Allowed: ${allowedKycExtensions.join(', ')}` });
      }

      // ✅ ADD: Validate MIME type
      const allowedKycMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png'
      ];
      if (!allowedKycMimeTypes.includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid file type. Only PDF and images allowed" });
      }

      // ✅ ADD: Validate file size (10MB max for KYC)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File too large. Maximum size is 10MB" });
      }

      // ✅ ADD: Validate file content (magic bytes)
      const { validateFileContent } = await import('./file-validation');
      const isValid = await validateFileContent(req.file.path, req.file.mimetype);
      if (!isValid) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File content does not match declared type" });
      }

      // ... rest of KYC logic ...
    } catch (error: any) {
      console.error("KYC document upload error:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to upload KYC document" });
    }
  });
});
```

---

### Fix 5: Validation Middleware for Documents

Create reusable validation middleware:

```typescript
// server/middleware/validateFileUpload.ts
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../auth';
import fs from 'fs';
import path from 'path';

export function validateDocumentUpload(maxSizeBytes: number = 50 * 1024 * 1024) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate extension against whitelist
      const ext = path.extname(req.file.originalname).toLowerCase();
      const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` 
        });
      }

      // Validate MIME type
      const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
      ];
      if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid file type" });
      }

      // Validate size
      if (req.file.size > maxSizeBytes) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: `File too large. Maximum size is ${maxSizeBytes / (1024 * 1024)}MB` 
        });
      }

      // Validate file content (magic bytes)
      const { validateFileContent } = await import('../file-validation');
      const isValid = await validateFileContent(req.file.path, req.file.mimetype);
      if (!isValid) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File content does not match declared type" });
      }

      next();
    } catch (error: any) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "File validation failed" });
    }
  };
}
```

**Use middleware**:
```typescript
app.post("/api/documents", 
  requireAuth, 
  requirePermission("documents.upload"), 
  upload.single('file'),
  validateDocumentUpload(50 * 1024 * 1024), // 50MB max
  async (req: AuthRequest, res: Response) => {
    // File is already validated by middleware
    // ... rest of logic ...
  }
);
```

---

## Security Best Practices

### Defense-in-Depth Strategy (4 Layers)

```
┌─────────────────────────────────────────────────┐
│ Layer 1: Multer fileFilter (Extension + MIME)  │ ← Blocks at upload time
├─────────────────────────────────────────────────┤
│ Layer 2: Endpoint Validation (Size + Type)     │ ← Double-check after upload
├─────────────────────────────────────────────────┤
│ Layer 3: Magic Byte Validation (file-type)     │ ← Verify actual file content
├─────────────────────────────────────────────────┤
│ Layer 4: Secure Serving (Content-Disposition)  │ ← Prevent execution on download
└─────────────────────────────────────────────────┘
```

### Layer 4: Secure File Serving

```typescript
app.get("/api/documents/:id/download", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const document = await storage.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Verify access permissions...
    
    const filePath = path.join(process.cwd(), document.url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // ✅ SECURITY: Force download instead of inline display
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    
    // ✅ SECURITY: Set correct Content-Type from database (not client)
    res.setHeader('Content-Type', document.type);
    
    // ✅ SECURITY: Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // ✅ SECURITY: Prevent framing
    res.setHeader('X-Frame-Options', 'DENY');
    
    res.sendFile(filePath);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to download document" });
  }
});
```

---

## Remediation Checklist

- [ ] **Install file-type library** - `npm install file-type`
- [ ] **Create file-validation.ts** - Magic byte validation utilities
- [ ] **Fix Multer config** - Add fileFilter and limits
- [ ] **Fix avatar upload** - Add magic byte validation
- [ ] **Fix KYC upload** - Add ALL validations (MIME, size, content)
- [ ] **Fix document upload** - Use validation middleware
- [ ] **Fix version upload** - Add validation
- [ ] **Fix bulk upload** - Add total size limit and per-file validation
- [ ] **Update download endpoint** - Add secure serving headers
- [ ] **Add automated tests** - Test file upload security

---

## Automated Testing Strategy

```typescript
// test/file-upload-security.test.ts
describe('File Upload Security Tests', () => {
  test('should reject executable file upload', async () => {
    const maliciousFile = Buffer.from('#!/bin/bash\nrm -rf /');
    const response = await uploadFile({
      filename: 'malware.sh',
      mimetype: 'application/pdf', // Spoofed MIME
      content: maliciousFile
    });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('File content does not match');
  });

  test('should reject oversized file (51MB)', async () => {
    const largeFile = Buffer.alloc(51 * 1024 * 1024);
    const response = await uploadFile({
      filename: 'huge.pdf',
      mimetype: 'application/pdf',
      content: largeFile
    });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('File too large');
  });

  test('should reject bulk upload >10 files', async () => {
    const files = Array(11).fill(null).map((_, i) => ({
      filename: `file${i}.pdf`,
      mimetype: 'application/pdf',
      content: Buffer.from('valid pdf')
    }));
    
    const response = await bulkUpload(files);
    expect(response.status).toBe(400);
  });
});
```

---

## Timeline

| Task | Priority | ETA |
|------|----------|-----|
| Install file-type library | 🚨 URGENT | 10 min |
| Fix Multer configuration | 🚨 URGENT | 30 min |
| Add validation middleware | 🚨 URGENT | 1 hour |
| Fix all 5 endpoints | HIGH | 2 hours |
| Add magic byte validation | HIGH | 1 hour |
| Update download headers | HIGH | 30 min |
| Implement automated tests | MEDIUM | 3 hours |

---

**Next Steps**: Apply fixes immediately. File upload vulnerabilities can lead to remote code execution if exploited.

**Reviewed By**: AI Security Audit Agent  
**Status**: AWAITING FIXES
