import { createHash } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { EngagementState } from '@moon/domain';
import { ALLOWED_STATES, AppError, type ActorContext, type EngagementRow } from './types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new AppError(400, 'INVALID_UUID', `${field} must be a valid UUID.`);
  }
  return value;
}

export function cleanText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new AppError(400, 'INVALID_TEXT', `${field} must be text.`);
  }
  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!normalized) throw new AppError(400, 'REQUIRED_FIELD', `${field} is required.`);
  if (normalized.length > maxLength) {
    throw new AppError(400, 'TEXT_TOO_LONG', `${field} must not exceed ${maxLength} characters.`);
  }
  return normalized;
}

export function isoDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'INVALID_DATE', `${field} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(400, 'INVALID_DATE', `${field} is not a valid calendar date.`);
  }
  return date;
}

export function statusOf(value: EngagementRow['status']): { state: EngagementState } {
  const parsed = typeof value === 'string' ? JSON.parse(value) as { state?: string } : value;
  if (!parsed || typeof parsed.state !== 'string' || !ALLOWED_STATES.has(parsed.state as EngagementState)) {
    throw new AppError(500, 'INVALID_STORED_STATUS', 'Stored engagement status is invalid.');
  }
  return { state: parsed.state as EngagementState };
}

export function actorFrom(response: Response): ActorContext {
  const actor = response.locals.actor as ActorContext | undefined;
  if (!actor) throw new AppError(500, 'ACTOR_CONTEXT_MISSING', 'Actor context was not initialized.');
  return actor;
}

function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export function integrityHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function serializeEngagement(row: EngagementRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientName: row.client_name,
    periodStart: new Date(row.period_start).toISOString().slice(0, 10),
    periodEnd: new Date(row.period_end).toISOString().slice(0, 10),
    status: statusOf(row.status),
    framework: row.framework,
    currency: row.currency,
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
