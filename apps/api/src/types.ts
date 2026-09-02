import type { EngagementState } from '@moon/domain';

export interface ActorContext {
  organizationId: string;
  userId: string;
}

export interface EngagementRow {
  id: string;
  organization_id: string;
  client_name: string;
  period_start: string | Date;
  period_end: string | Date;
  status: { state: EngagementState } | string;
  framework: 'IFRS' | 'IFRS_SME' | 'Other';
  currency: string;
  revision: number;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const ALLOWED_FRAMEWORKS = new Set(['IFRS', 'IFRS_SME', 'Other']);
export const ALLOWED_STATES = new Set<EngagementState>([
  'draft',
  'acceptance',
  'planning',
  'fieldwork',
  'review',
  'reporting',
  'archived',
  'on_hold',
]);

export const TRANSITIONS: Record<EngagementState, readonly EngagementState[]> = {
  draft: ['acceptance', 'on_hold'],
  acceptance: ['planning', 'draft', 'on_hold'],
  planning: ['fieldwork', 'draft', 'on_hold'],
  fieldwork: ['review', 'on_hold'],
  review: ['reporting', 'fieldwork', 'on_hold'],
  reporting: ['archived', 'on_hold'],
  archived: [],
  on_hold: ['draft', 'acceptance', 'planning', 'fieldwork', 'review', 'reporting'],
};
