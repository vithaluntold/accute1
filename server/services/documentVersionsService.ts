import { db } from "../db";
import { documentVersions, documents } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export class DocumentVersionsService {
  /**
   * Create a new version of a document
   * SECURITY: Validates document belongs to organization
   * INTEGRITY: Requires pre-computed hash of actual file contents (SHA-256)
   */
  static async createVersion(
    documentId: string,
    organizationId: string,
    versionData: {
      name: string;
      type: string;
      size: number;
      url: string;
      uploadedBy: string;
      documentHash: string; // REQUIRED: SHA-256 hash of actual file bytes
      digitalSignature?: string; // Optional: RSA signature of the hash
      changeDescription?: string;
      changeType?: "major" | "minor" | "patch";
      encryptedContent?: string;
    }
  ) {
    // SECURITY: Verify document belongs to organization
    const document = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        )
      )
      .limit(1);

    if (document.length === 0) {
      throw new Error("Document not found or unauthorized");
    }

    // VALIDATION: Ensure documentHash is provided and valid format
    if (!versionData.documentHash || !/^[a-f0-9]{64}$/i.test(versionData.documentHash)) {
      throw new Error("Valid SHA-256 document hash (64 hex chars) is required");
    }

    // Get the latest version number
    const latestVersion = await db
      .select({ versionNumber: documentVersions.versionNumber })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber))
      .limit(1);

    const nextVersionNumber = latestVersion.length > 0 ? latestVersion[0].versionNumber + 1 : 1;

    // Create the new version
    const [version] = await db
      .insert(documentVersions)
      .values({
        documentId,
        versionNumber: nextVersionNumber,
        name: versionData.name,
        type: versionData.type,
        size: versionData.size,
        url: versionData.url,
        uploadedBy: versionData.uploadedBy,
        organizationId,
        changeDescription: versionData.changeDescription || null,
        changeType: versionData.changeType || "minor",
        documentHash: versionData.documentHash, // Actual file hash from caller
        digitalSignature: versionData.digitalSignature || null, // PKI signature if provided
        encryptedContent: versionData.encryptedContent || null,
      })
      .returning();

    // Update the main document with the new version
    await db
      .update(documents)
      .set({
        name: versionData.name,
        type: versionData.type,
        size: versionData.size,
        url: versionData.url,
        documentHash: versionData.documentHash, // Update hash
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    return version;
  }

  /**
   * Get all versions of a document
   */
  static async getVersionHistory(documentId: string, organizationId: string) {
    // SECURITY: Verify document belongs to organization
    const document = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        )
      )
      .limit(1);

    if (document.length === 0) {
      throw new Error("Document not found or unauthorized");
    }

    const versions = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber));

    return versions;
  }

  /**
   * Get a specific version of a document
   */
  static async getVersion(versionId: string, organizationId: string) {
    const version = await db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.id, versionId),
          eq(documentVersions.organizationId, organizationId)
        )
      )
      .limit(1);

    if (version.length === 0) {
      throw new Error("Version not found or unauthorized");
    }

    return version[0];
  }

  /**
   * Rollback document to a previous version
   * Creates a new version that is a copy of the specified version
   */
  static async rollbackToVersion(
    documentId: string,
    targetVersionNumber: number,
    organizationId: string,
    userId: string
  ) {
    // Get the target version
    const targetVersion = await db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, documentId),
          eq(documentVersions.versionNumber, targetVersionNumber),
          eq(documentVersions.organizationId, organizationId)
        )
      )
      .limit(1);

    if (targetVersion.length === 0) {
      throw new Error("Target version not found");
    }

    // Create a new version that is a copy of the target version
    const newVersion = await this.createVersion(documentId, organizationId, {
      name: targetVersion[0].name,
      type: targetVersion[0].type,
      size: targetVersion[0].size,
      url: targetVersion[0].url,
      uploadedBy: userId,
      documentHash: targetVersion[0].documentHash, // Reuse original hash
      digitalSignature: targetVersion[0].digitalSignature || undefined,
      changeDescription: `Rolled back to version ${targetVersionNumber}`,
      changeType: "major",
      encryptedContent: targetVersion[0].encryptedContent || undefined,
    });

    return newVersion;
  }

  /**
   * Approve a document version (for compliance workflows)
   */
  static async approveVersion(
    versionId: string,
    organizationId: string,
    approvedBy: string
  ) {
    const [approved] = await db
      .update(documentVersions)
      .set({
        approvalStatus: "approved",
        approvedBy,
        approvedAt: new Date(),
      })
      .where(
        and(
          eq(documentVersions.id, versionId),
          eq(documentVersions.organizationId, organizationId)
        )
      )
      .returning();

    if (!approved) {
      throw new Error("Version not found or unauthorized");
    }

    return approved;
  }

  /**
   * Reject a document version (for compliance workflows)
   */
  static async rejectVersion(
    versionId: string,
    organizationId: string,
    approvedBy: string,
    rejectionReason: string
  ) {
    const [rejected] = await db
      .update(documentVersions)
      .set({
        approvalStatus: "rejected",
        approvedBy,
        approvedAt: new Date(),
        rejectionReason,
      })
      .where(
        and(
          eq(documentVersions.id, versionId),
          eq(documentVersions.organizationId, organizationId)
        )
      )
      .returning();

    if (!rejected) {
      throw new Error("Version not found or unauthorized");
    }

    return rejected;
  }

  /**
   * Compare two versions of a document
   * Returns metadata for diff generation on the client
   */
  static async compareVersions(
    documentId: string,
    versionNumber1: number,
    versionNumber2: number,
    organizationId: string
  ) {
    const versions = await db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, documentId),
          eq(documentVersions.organizationId, organizationId)
        )
      )
      .orderBy(desc(documentVersions.versionNumber));

    const version1 = versions.find(v => v.versionNumber === versionNumber1);
    const version2 = versions.find(v => v.versionNumber === versionNumber2);

    if (!version1 || !version2) {
      throw new Error("One or both versions not found");
    }

    return {
      version1,
      version2,
      sizeDiff: version2.size - version1.size,
      timeDiff: version2.createdAt.getTime() - version1.createdAt.getTime(),
      // Client will fetch the actual files and perform diff
    };
  }

  /**
   * Delete old versions (retention policy)
   * Keeps the latest N versions and deletes older ones
   */
  static async enforceRetentionPolicy(
    documentId: string,
    organizationId: string,
    keepLatest: number = 10
  ) {
    const versions = await db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, documentId),
          eq(documentVersions.organizationId, organizationId)
        )
      )
      .orderBy(desc(documentVersions.versionNumber));

    if (versions.length <= keepLatest) {
      return { deleted: 0 };
    }

    const versionsToDelete = versions.slice(keepLatest);
    let deleted = 0;

    for (const version of versionsToDelete) {
      await db
        .delete(documentVersions)
        .where(eq(documentVersions.id, version.id));
      deleted++;
    }

    return { deleted };
  }
}
