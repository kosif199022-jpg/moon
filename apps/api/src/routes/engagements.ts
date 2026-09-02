import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { EngagementFactory, type EngagementState } from '@moon/domain';
import { appendAuditEvent } from '../audit.js';
import { pool, withTransaction } from '../db.js';
import {
  actorFrom,
  asyncRoute,
  cleanText,
  isoDate,
  requireUuid,
  serializeEngagement,
  statusOf,
} from '../http.js';
import {
  ALLOWED_FRAMEWORKS,
  ALLOWED_STATES,
  AppError,
  TRANSITIONS,
  type EngagementRow,
} from '../types.js';

export const engagementRouter = Router();

engagementRouter.post('/engagements', asyncRoute(async (request, response) => {
  const actor = actorFrom(response);
  const clientName = cleanText(request.body?.clientName, 'clientName', 240);
  const periodStart = isoDate(request.body?.periodStart, 'periodStart');
  const periodEnd = isoDate(request.body?.periodEnd, 'periodEnd');
  if (periodEnd <= periodStart) {
    throw new AppError(400, 'INVALID_PERIOD', 'periodEnd must be after periodStart.');
  }

  const framework = request.body?.framework;
  if (typeof framework !== 'string' || !ALLOWED_FRAMEWORKS.has(framework)) {
    throw new AppError(400, 'INVALID_FRAMEWORK', 'framework must be IFRS, IFRS_SME, or Other.');
  }
  const currency = request.body?.currency === undefined
    ? 'SAR'
    : cleanText(request.body.currency, 'currency', 12).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new AppError(400, 'INVALID_CURRENCY', 'currency must be a three-letter uppercase ISO code.');
  }

  const engagement = EngagementFactory.create(
    randomUUID(),
    actor.organizationId,
    clientName,
    periodStart,
    periodEnd,
    framework as 'IFRS' | 'IFRS_SME' | 'Other',
    currency,
    actor.userId,
  );

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO engagements
        (id, organization_id, client_name, period_start, period_end, framework, currency,
         status, revision, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        engagement.id,
        engagement.organizationId,
        engagement.clientName,
        engagement.periodStart,
        engagement.periodEnd,
        engagement.framework,
        engagement.currency,
        JSON.stringify(engagement.status),
        engagement.revision,
        engagement.createdBy,
        engagement.createdAt,
        engagement.updatedAt,
      ],
    );
    await appendAuditEvent(client, {
      engagementId: engagement.id,
      actor,
      action: 'ENGAGEMENT_CREATED',
      targetType: 'engagement',
      targetId: engagement.id,
      targetVersion: engagement.revision,
      details: {
        framework: engagement.framework,
        periodStart: request.body.periodStart,
        periodEnd: request.body.periodEnd,
      },
    });
  });

  response.status(201).json(engagement.toJSON());
}));

engagementRouter.get('/engagements', asyncRoute(async (request, response) => {
  const actor = actorFrom(response);
  const limitRaw = Number.parseInt(String(request.query.limit ?? '50'), 10);
  const offsetRaw = Number.parseInt(String(request.query.offset ?? '0'), 10);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const offset = Number.isInteger(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const result = await pool.query<EngagementRow>(
    `SELECT * FROM engagements
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [actor.organizationId, limit, offset],
  );
  response.json({ items: result.rows.map(serializeEngagement), limit, offset });
}));

engagementRouter.get('/engagements/:id', asyncRoute(async (request, response) => {
  const actor = actorFrom(response);
  const engagementId = requireUuid(request.params.id, 'engagement id');
  const result = await pool.query<EngagementRow>(
    'SELECT * FROM engagements WHERE id = $1 AND organization_id = $2',
    [engagementId, actor.organizationId],
  );
  if (!result.rowCount) throw new AppError(404, 'ENGAGEMENT_NOT_FOUND', 'Engagement not found.');
  response.json(serializeEngagement(result.rows[0]!));
}));

engagementRouter.put('/engagements/:id/status', asyncRoute(async (request, response) => {
  const actor = actorFrom(response);
  const engagementId = requireUuid(request.params.id, 'engagement id');
  const newState = request.body?.newState;
  if (typeof newState !== 'string' || !ALLOWED_STATES.has(newState as EngagementState)) {
    throw new AppError(400, 'INVALID_STATE', 'newState is not a recognized engagement state.');
  }
  const expectedRevision = request.body?.expectedRevision;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new AppError(400, 'EXPECTED_REVISION_REQUIRED', 'expectedRevision must be a positive integer.');
  }
  const reason = cleanText(request.body?.reason, 'reason', 1_000);

  const updated = await withTransaction(async (client) => {
    const currentResult = await client.query<EngagementRow>(
      'SELECT * FROM engagements WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [engagementId, actor.organizationId],
    );
    if (!currentResult.rowCount) throw new AppError(404, 'ENGAGEMENT_NOT_FOUND', 'Engagement not found.');

    const current = currentResult.rows[0]!;
    if (current.revision !== expectedRevision) {
      throw new AppError(409, 'REVISION_CONFLICT', 'The engagement changed after it was loaded.', {
        expectedRevision,
        currentRevision: current.revision,
      });
    }
    const currentState = statusOf(current.status).state;
    if (!(TRANSITIONS[currentState] ?? []).includes(newState as EngagementState)) {
      throw new AppError(409, 'TRANSITION_NOT_ALLOWED', `Cannot transition from ${currentState} to ${newState}.`);
    }

    const nextRevision = current.revision + 1;
    const nextStatus = newState === 'on_hold'
      ? { state: newState, blockedReason: reason, blockedSince: new Date().toISOString() }
      : { state: newState };
    const result = await client.query<EngagementRow>(
      `UPDATE engagements
          SET status = $1, revision = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4 AND revision = $5
        RETURNING *`,
      [JSON.stringify(nextStatus), nextRevision, engagementId, actor.organizationId, expectedRevision],
    );
    if (!result.rowCount) throw new AppError(409, 'REVISION_CONFLICT', 'The engagement changed during the update.');

    await appendAuditEvent(client, {
      engagementId,
      actor,
      action: 'ENGAGEMENT_STATUS_CHANGED',
      targetType: 'engagement',
      targetId: engagementId,
      targetVersion: nextRevision,
      details: { from: currentState, to: newState, reason },
    });
    return result.rows[0]!;
  });

  response.json(serializeEngagement(updated));
}));
