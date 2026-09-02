/**
 * Evidence Entity - Represents audit evidence
 * Evidence is a professional unit with source integrity, relevance, and reliability assessment
 */

export type EvidenceClassification =
  | 'document'
  | 'spreadsheet'
  | 'email'
  | 'communication'
  | 'media';

export type EvidenceReviewState =
  | 'captured'
  | 'linked'
  | 'evaluated'
  | 'accepted'
  | 'rejected';

export type ReliabilityScore = 1 | 2 | 3 | 4 | 5;
export type RelevanceScore = 1 | 2 | 3 | 4 | 5;

export class Evidence {
  id: string;
  engagementId: string;
  objectKey: string; // S3 path: engagement_id/sha256/filename
  sha256: string;
  filename: string;
  fileSize: bigint;
  classification: EvidenceClassification;
  relevanceScore: RelevanceScore;
  reliabilityScore: ReliabilityScore;
  reviewState: EvidenceReviewState;
  sourceRef?: string; // Where it came from (e.g., client email, website)
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    engagementId: string,
    objectKey: string,
    sha256: string,
    filename: string,
    fileSize: bigint,
    classification: EvidenceClassification,
    uploadedBy: string
  ) {
    this.id = id;
    this.engagementId = engagementId;
    this.objectKey = objectKey;
    this.sha256 = sha256;
    this.filename = filename;
    this.fileSize = fileSize;
    this.classification = classification;
    this.uploadedBy = uploadedBy;
    this.createdAt = new Date();
    this.updatedAt = new Date();

    // Default assessment scores
    this.relevanceScore = 3; // Neutral until reviewed
    this.reliabilityScore = 4; // Uploaded documents trusted by default
    this.reviewState = 'captured';
  }

  /**
   * Link evidence to procedure/risk/etc
   */
  link(): void {
    if (this.reviewState !== 'captured') {
      throw new Error('Evidence must be in captured state to link');
    }
    this.reviewState = 'linked';
    this.updatedAt = new Date();
  }

  /**
   * Assess relevance and reliability
   */
  assess(
    relevanceScore: RelevanceScore,
    reliabilityScore: ReliabilityScore,
    sourceRef?: string
  ): void {
    this.relevanceScore = relevanceScore;
    this.reliabilityScore = reliabilityScore;
    this.sourceRef = sourceRef;
    this.reviewState = 'evaluated';
    this.updatedAt = new Date();
  }

  /**
   * Accept evidence as valid for audit
   */
  accept(reviewer: string): void {
    if (this.reviewState === 'accepted') {
      throw new Error('Evidence already accepted');
    }

    if (this.reviewState === 'rejected') {
      throw new Error('Cannot accept rejected evidence; create new version');
    }

    this.reviewState = 'accepted';
    this.updatedAt = new Date();
  }

  /**
   * Reject evidence
   * @param reason - Why evidence is rejected (for audit trail)
   */
  reject(reviewer: string, reason: string): void {
    if (this.reviewState === 'accepted') {
      throw new Error('Cannot reject accepted evidence; create new version');
    }

    this.reviewState = 'rejected';
    this.updatedAt = new Date();
  }

  /**
   * Check if evidence is high quality (high relevance & reliability)
   */
  isHighQuality(): boolean {
    return this.relevanceScore >= 4 && this.reliabilityScore >= 4;
  }

  /**
   * Check if evidence is acceptable for critical assertions
   */
  isAcceptable(): boolean {
    return this.reviewState === 'accepted';
  }

  /**
   * Get quality score (0-10)
   */
  getQualityScore(): number {
    return (this.relevanceScore + this.reliabilityScore) / 2;
  }

  /**
   * Get file size in readable format
   */
  getFileSizeReadable(): string {
    const size = Number(this.fileSize);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      engagementId: this.engagementId,
      objectKey: this.objectKey,
      sha256: this.sha256,
      filename: this.filename,
      fileSize: this.fileSize.toString(),
      classification: this.classification,
      relevanceScore: this.relevanceScore,
      reliabilityScore: this.reliabilityScore,
      reviewState: this.reviewState,
      sourceRef: this.sourceRef,
      uploadedBy: this.uploadedBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

/**
 * Evidence Factory
 */
export class EvidenceFactory {
  static create(
    id: string,
    engagementId: string,
    objectKey: string,
    sha256: string,
    filename: string,
    fileSize: bigint,
    classification: EvidenceClassification,
    uploadedBy: string
  ): Evidence {
    // Validation
    if (!sha256 || sha256.length !== 64) {
      throw new Error('Invalid SHA256 hash');
    }

    if (!filename || filename.trim() === '') {
      throw new Error('Filename is required');
    }

    if (fileSize <= 0n) {
      throw new Error('File size must be positive');
    }

    return new Evidence(
      id,
      engagementId,
      objectKey,
      sha256,
      filename,
      fileSize,
      classification,
      uploadedBy
    );
  }

  /**
   * Reconstruct evidence from database
   */
  static fromDatabase(row: any): Evidence {
    const evidence = new Evidence(
      row.id,
      row.engagement_id,
      row.object_key,
      row.sha256,
      row.filename,
      BigInt(row.file_size),
      row.classification,
      row.uploaded_by
    );

    evidence.relevanceScore = row.relevance_score;
    evidence.reliabilityScore = row.reliability_score;
    evidence.reviewState = row.review_state;
    evidence.sourceRef = row.source_ref;
    evidence.createdAt = new Date(row.created_at);
    evidence.updatedAt = new Date(row.updated_at);

    return evidence;
  }
}
