/**
 * Risk Entity - Represents an identified audit risk
 * Risks are identified through materiality and account analysis
 */

export type RiskType = 'inherent' | 'control' | 'detection';
export type RiskStatus =
  | 'identified'
  | 'assessed'
  | 'significant'
  | 'responded'
  | 'closed';

export type AssertionType =
  | 'existence'
  | 'occurrence'
  | 'completeness'
  | 'accuracy'
  | 'valuation'
  | 'rights_and_obligations'
  | 'presentation'
  | 'disclosure';

export interface RiskFactor {
  factor: string;
  description: string;
  severity: number; // 1-5
}

export class Risk {
  id: string;
  engagementId: string;
  area: string; // Revenue, Payables, Inventory, etc.
  assertions: AssertionType[];
  riskType: RiskType;
  score: number; // 0-100
  factors: RiskFactor[];
  rationale: string;
  status: RiskStatus;
  revision: number;
  reviewState: 'draft' | 'reviewed' | 'approved';
  createdBy: string;
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    engagementId: string,
    area: string,
    assertions: AssertionType[],
    riskType: RiskType,
    score: number,
    rationale: string,
    createdBy: string
  ) {
    this.id = id;
    this.engagementId = engagementId;
    this.area = area;
    this.assertions = assertions;
    this.riskType = riskType;
    this.score = score;
    this.rationale = rationale;
    this.createdBy = createdBy;
    this.factors = [];
    this.status = 'identified';
    this.revision = 1;
    this.reviewState = 'draft';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Add a risk factor
   */
  addFactor(factor: string, description: string, severity: 1 | 2 | 3 | 4 | 5): void {
    this.factors.push({ factor, description, severity });
    this.updatedAt = new Date();
  }

  /**
   * Check if risk is significant (score > 60)
   */
  isSignificant(): boolean {
    return this.score > 60;
  }

  /**
   * Approve risk assessment
   */
  approve(approver: string): void {
    if (this.reviewState === 'approved') {
      throw new Error('Risk already approved');
    }

    this.reviewState = 'approved';
    this.reviewedBy = approver;
    this.revision++;
    this.updatedAt = new Date();
  }

  /**
   * Mark risk as responded
   */
  respond(): void {
    if (this.status !== 'assessed' && this.status !== 'significant') {
      throw new Error('Risk must be assessed or significant to respond');
    }

    this.status = 'responded';
    this.revision++;
    this.updatedAt = new Date();
  }

  /**
   * Close risk
   */
  close(): void {
    if (this.status !== 'responded') {
      throw new Error('Risk must be responded to before closing');
    }

    this.status = 'closed';
    this.revision++;
    this.updatedAt = new Date();
  }

  /**
   * Recalculate risk based on new factors
   * (Called when evidence changes)
   */
  recalculate(newScore: number, newFactors: RiskFactor[]): void {
    if (newScore === this.score && JSON.stringify(newFactors) === JSON.stringify(this.factors)) {
      return; // No change
    }

    this.score = newScore;
    this.factors = newFactors;
    this.revision++;
    this.updatedAt = new Date();

    // If risk changes from non-significant to significant, mark for review
    if (newScore > 60 && this.status === 'identified') {
      this.status = 'assessed';
    }
  }

  /**
   * Get risk level description
   */
  getRiskLevel(): 'Low' | 'Medium' | 'High' | 'Very High' {
    if (this.score < 30) return 'Low';
    if (this.score < 60) return 'Medium';
    if (this.score < 80) return 'High';
    return 'Very High';
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      engagementId: this.engagementId,
      area: this.area,
      assertions: this.assertions,
      riskType: this.riskType,
      score: this.score,
      factors: this.factors,
      rationale: this.rationale,
      status: this.status,
      riskLevel: this.getRiskLevel(),
      reviewState: this.reviewState,
      revision: this.revision,
      createdBy: this.createdBy,
      reviewedBy: this.reviewedBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

/**
 * Risk Factory
 */
export class RiskFactory {
  static create(
    id: string,
    engagementId: string,
    area: string,
    assertions: AssertionType[],
    riskType: RiskType,
    score: number,
    rationale: string,
    createdBy: string
  ): Risk {
    // Validation
    if (!area || area.trim() === '') {
      throw new Error('Risk area is required');
    }

    if (assertions.length === 0) {
      throw new Error('At least one assertion must be specified');
    }

    if (score < 0 || score > 100) {
      throw new Error('Risk score must be between 0 and 100');
    }

    if (!rationale || rationale.trim() === '') {
      throw new Error('Risk rationale is required');
    }

    return new Risk(
      id,
      engagementId,
      area,
      assertions,
      riskType,
      score,
      rationale,
      createdBy
    );
  }

  /**
   * Reconstruct risk from database
   */
  static fromDatabase(row: any): Risk {
    const risk = new Risk(
      row.id,
      row.engagement_id,
      row.area,
      row.assertions || [],
      row.risk_type,
      row.score,
      row.rationale,
      row.created_by
    );

    risk.factors = row.factors || [];
    risk.status = row.status;
    risk.reviewState = row.review_state;
    risk.revision = row.revision;
    risk.reviewedBy = row.reviewed_by;
    risk.createdAt = new Date(row.created_at);
    risk.updatedAt = new Date(row.updated_at);

    return risk;
  }
}
