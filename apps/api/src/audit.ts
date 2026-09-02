import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { integrityHash } from './http.js';
import type { ActorContext } from './types.js';

interface AuditEventInput {
  engagementId: string;
  actor: ActorContext;
  action: string;
  targetType: string;
  targetId: string;
  targetVersion?: number;
  details?: Record<string, unknown>;
  correlationId?: string;
}

export async function appendAuditEvent(client: PoolClient, input: AuditEventInput): Promise<void> {
  const eventId = randomUUID();
  const occurredAt = new Date();
  const eventPayload = {
    eventId,
    engagementId: input.engagementId,
    actorType: 'human',
    actorId: input.actor.userId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    targetVersion: input.targetVersion ?? null,
    correlationId: input.correlationId ?? null,
    details: input.details ?? {},
    occurredAt: occurredAt.toISOString(),
  };

  await client.query(
    `INSERT INTO audit_events
      (event_id, engagement_id, actor_type, actor_id, action, target_type, target_id,
       target_version, correlation_id, details, integrity_hash, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      eventId,
      input.engagementId,
      'human',
      input.actor.userId,
      input.action,
      input.targetType,
      input.targetId,
      input.targetVersion ?? null,
      input.correlationId ?? null,
      JSON.stringify(input.details ?? {}),
      integrityHash(eventPayload),
      occurredAt,
    ],
  );
}
