/**
 * Engagement Entity - Represents a single audit engagement/file
 * Manages the complete audit lifecycle from draft to archive
 */

export type EngagementState =
  | 'draft'
  | 'acceptance'
  | 'planning'
  | 'fieldwork'
  | 'review'
  | 'reporting'
  | 'archived'
  | 'on_hold';

export interface EngagementStatus {
  state: EngagementState;
  blockedReason?: string;
  blockedSince?: Date;
}

export class Engagement {
  id: string;
  organizationId: string;
  clientName: string;
  periodStart: Date;
  periodEnd: Date;
  status: EngagementStatus;
  framework: 'IFRS' | 'IFRS_SME' | 'Other';
  currency: string;
  revision: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    organizationId: string,
    clientName: string,
    periodStart: Date,
    periodEnd: Date,
    framework: 'IFRS' | 'IFRS_SME' | 'Other',
    currency: string = 'SAR',
    createdBy: string = 'system'
  ) {
    this.id = id;
    this.organizationId = organizationId;
    this.clientName = clientName;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.framework = framework;
    this.currency = currency;
    this.revision = 1;
    this.createdBy = createdBy;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.status = { state: 'draft' };
  }

  /**
   * Check if transition to new state is allowed
   */
  canTransitionTo(newState: EngagementState): boolean {
    const validTransitions: Record<EngagementState, EngagementState[]> = {
      draft: ['acceptance', 'on_hold'],
      acceptance: ['planning', 'draft', 'on_hold'],
      planning: ['fieldwork', 'draft', 'on_hold'],
      fieldwork: ['review', 'on_hold'],
      review: ['reporting', 'fieldwork', 'on_hold'],
      reporting: ['archived', 'on_hold'],
      archived: [], // Terminal state
      on_hold: ['draft', 'acceptance', 'planning', 'fieldwork', 'review', 'reporting'],
    };

    return validTransitions[this.status.state]?.includes(newState) ?? false;
  }

  /**
   * Transition to a new state
   * @throws Error if transition is not allowed
   */
  transitionTo(newState: EngagementState, reason?: string): void {
    if (!this.canTransitionTo(newState)) {
      throw new Error(
        `Cannot transition from ${this.status.state} to ${newState}`
      );
    }

    this.status = { state: newState };
    this.revision++;
    this.updatedAt = new Date();
  }

  /**
   * Put engagement on hold
   */
  hold(reason: string): void {
    if (this.status.state === 'archived') {
      throw new Error('Cannot hold archived engagement');
    }

    this.status = {
      state: 'on_hold',
      blockedReason: reason,
      blockedSince: new Date(),
    };
    this.updatedAt = new Date();
  }

  /**
   * Resume from hold
   * @throws Error if not on hold
   */
  resume(previousState: EngagementState): void {
    if (this.status.state !== 'on_hold') {
      throw new Error('Engagement is not on hold');
    }

    if (!this.canTransitionTo(previousState)) {
      throw new Error(`Cannot resume to state: ${previousState}`);
    }

    this.transitionTo(previousState);
  }

  /**
   * Archive engagement (terminal state)
   */
  archive(): void {
    if (!this.canTransitionTo('archived')) {
      throw new Error(
        `Cannot archive engagement in ${this.status.state} state`
      );
    }

    this.status = { state: 'archived' };
    this.revision++;
    this.updatedAt = new Date();
  }

  /**
   * Get all valid next states
   */
  getValidNextStates(): EngagementState[] {
    const validTransitions: Record<EngagementState, EngagementState[]> = {
      draft: ['acceptance', 'on_hold'],
      acceptance: ['planning', 'draft', 'on_hold'],
      planning: ['fieldwork', 'draft', 'on_hold'],
      fieldwork: ['review', 'on_hold'],
      review: ['reporting', 'fieldwork', 'on_hold'],
      reporting: ['archived', 'on_hold'],
      archived: [],
      on_hold: ['draft', 'acceptance', 'planning', 'fieldwork', 'review', 'reporting'],
    };

    return validTransitions[this.status.state] ?? [];
  }

  /**
   * Check if engagement is closed
   */
  isClosed(): boolean {
    return this.status.state === 'archived';
  }

  /**
   * Check if engagement is in fieldwork
   */
  isInFieldwork(): boolean {
    return this.status.state === 'fieldwork';
  }

  /**
   * Check if engagement is on hold
   */
  isOnHold(): boolean {
    return this.status.state === 'on_hold';
  }

  /**
   * Get engagement age in days
   */
  getAgeDays(): number {
    const now = new Date();
    const diff = now.getTime() - this.createdAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Format for display
   */
  toString(): string {
    return `${this.clientName} (${this.periodStart.getFullYear()}) - ${this.status.state}`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      organizationId: this.organizationId,
      clientName: this.clientName,
      periodStart: this.periodStart.toISOString(),
      periodEnd: this.periodEnd.toISOString(),
      status: this.status,
      framework: this.framework,
      currency: this.currency,
      revision: this.revision,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

/**
 * Engagement Factory
 */
export class EngagementFactory {
  static create(
    id: string,
    organizationId: string,
    clientName: string,
    periodStart: Date,
    periodEnd: Date,
    framework: 'IFRS' | 'IFRS_SME' | 'Other',
    currency?: string,
    createdBy?: string
  ): Engagement {
    // Validation
    if (!clientName || clientName.trim() === '') {
      throw new Error('Client name is required');
    }

    if (periodEnd <= periodStart) {
      throw new Error('Period end must be after period start');
    }

    return new Engagement(
      id,
      organizationId,
      clientName,
      periodStart,
      periodEnd,
      framework,
      currency,
      createdBy
    );
  }

  /**
   * Reconstruct engagement from database
   */
  static fromDatabase(row: any): Engagement {
    const engagement = new Engagement(
      row.id,
      row.organization_id,
      row.client_name,
      new Date(row.period_start),
      new Date(row.period_end),
      row.framework,
      row.currency,
      row.created_by
    );

    engagement.revision = row.revision;
    engagement.createdAt = new Date(row.created_at);
    engagement.updatedAt = new Date(row.updated_at);
    engagement.status = row.status || { state: 'draft' };

    return engagement;
  }
}
