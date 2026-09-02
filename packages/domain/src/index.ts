import { Engagement, EngagementFactory } from './entities/Engagement.js';
import { Evidence, EvidenceFactory } from './entities/Evidence.js';
import { Risk, RiskFactory } from './entities/Risk.js';

export { MoneyValue, MoneyCalculator } from './value-objects/Money.js';
export type { Money, Money as IMoneyObject } from './value-objects/Money.js';

export { ProvenanceEnvelope, ProvenanceBuilder } from './value-objects/Provenance.js';
export type { Provenance, Provenance as IProvenance } from './value-objects/Provenance.js';

export { Engagement, EngagementFactory };
export type { EngagementState, EngagementStatus } from './entities/Engagement.js';

export { Evidence, EvidenceFactory };
export type {
  EvidenceClassification,
  EvidenceReviewState,
  ReliabilityScore,
  RelevanceScore,
} from './entities/Evidence.js';

export { Risk, RiskFactory };
export type { RiskType, RiskStatus, AssertionType, RiskFactor } from './entities/Risk.js';

export interface IEngagementRepository {
  save(engagement: Engagement): Promise<void>;
  findById(id: string): Promise<Engagement | null>;
  findByOrganization(organizationId: string): Promise<Engagement[]>;
}

export interface IEvidenceRepository {
  save(evidence: Evidence): Promise<void>;
  findById(id: string): Promise<Evidence | null>;
  findByEngagement(engagementId: string): Promise<Evidence[]>;
  findBySha256(engagementId: string, sha256: string): Promise<Evidence | null>;
}

export interface IRiskRepository {
  save(risk: Risk): Promise<void>;
  findById(id: string): Promise<Risk | null>;
  findByEngagement(engagementId: string): Promise<Risk[]>;
}

export interface IAuditEventLog {
  append(event: AuditEvent): Promise<void>;
  findByEngagement(engagementId: string): Promise<AuditEvent[]>;
}

export interface AuditEvent {
  eventId: string;
  engagementId: string;
  actor: {
    type: 'human' | 'ai' | 'system';
    id: string;
  };
  action: string;
  target: {
    type: string;
    id: string;
    version?: number;
  };
  correlationId?: string;
  details?: Record<string, unknown>;
  occurredAt: Date;
}
