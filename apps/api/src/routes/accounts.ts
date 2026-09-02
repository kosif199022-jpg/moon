import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { MoneyValue } from '@moon/domain';
import { appendAuditEvent } from '../audit.js';
import { pool, withTransaction } from '../db.js';
import { actorFrom, asyncRoute, cleanText, requireUuid } from '../http.js';
import { AppError } from '../types.js';

export const accountRouter = Router();

accountRouter.post('/engagements/:engagementId/accounts', asyncRoute(async (request, response) => {
  const actor = actorFrom(response);
  const engagementId = requireUuid(request.params.engagementId, 'engagement id');
  const code = cleanText(request.body?.code, 'code', 80);
  const name = cleanText(request.body?.name, 'name', 240);
  const balanceType = request.body?.balanceType ?? 'DEBIT';
  if (balanceType !== 'DEBIT' && balanceType !== 'CREDIT') {
    throw new AppError(400, 'INVALID_BALANCE_TYPE', 'balanceType must be DEBIT or CREDIT.');
  }

  const rawMinor = request.body?.balanceMinor;
  if ((typeof rawMinor !== 'string' && typeof rawMinor !== 'number') || !/^-?\d+$/.test(String(rawMinor))) {
    throw new AppError(400, 'INVALID_MINOR_AMOUNT', 'balanceMinor must be an integer string or safe integer.');
  }
  if (typeof rawMinor === 'number' && !Number.isSafeInteger(rawMinor)) {
    throw new AppError(400, 'UNSAFE_MINOR_AMOUNT', 'Numeric balanceMinor must be a safe integer; use a string for larger values.');
  }
  if (String(rawMinor).replace('-', '').length > 38) {
    throw new AppError(400, 'AMOUNT_TOO_LARGE', 'balanceMinor exceeds the supported precision.');
  }

  const created = await withTransaction(async (client) => {
    const engagement = await client.query<{ currency: string }>(
      'SELECT currency FROM engagements WHERE id = $1 AND organization_id = $2 FOR SHARE',
      [engagementId, actor.organizationId],
    );
    if (!engagement.rowCount) throw new AppError(404, 'ENGAGEMENT_NOT_FOUND', 'Engagement not found.');

    const money = MoneyValue.fromMinor(String(rawMinor), engagement.rows[0]!.currency);
    const accountId = randomUUID();
    await client.query(
      `INSERT INTO accounts
        (id, engagement_id, code, name, balance_minor, balance_exp, currency,
         balance_type, review_state, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',NOW(),NOW())`,
      [accountId, engagementId, code, name, money.minor.toString(), money.exp, money.currency, balanceType],
    );

    await appendAuditEvent(client, {
      engagementId,
      actor,
      action: 'ACCOUNT_CREATED',
      targetType: 'account',
      targetId: accountId,
      targetVersion: 1,
      details: { code, balanceMinor: money.minor.toString(), balanceType },
    });

    return {
      id: accountId,
      code,
      name,
      balanceMinor: money.minor.toString(),
      balanceFormatted: MoneyValue.format(money, 'ar-SA'),
      currency: money.currency,
      balanceType,
      reviewState: 'draft',
    };
  });

  response.status(201).json(created);
}));

accountRouter.get('/engagements/:engagementId/accounts', asyncRoute(async (request, response) => {
  const actor = actorFrom(response);
  const engagementId = requireUuid(request.params.engagementId, 'engagement id');
  const result = await pool.query<{
    id: string;
    code: string;
    name: string;
    balance_minor: string;
    currency: string;
    balance_type: 'DEBIT' | 'CREDIT';
    review_state: string;
  }>(
    `SELECT a.id, a.code, a.name, a.balance_minor, a.currency, a.balance_type, a.review_state
       FROM accounts a
       JOIN engagements e ON e.id = a.engagement_id
      WHERE a.engagement_id = $1 AND e.organization_id = $2
      ORDER BY a.code`,
    [engagementId, actor.organizationId],
  );

  response.json({
    items: result.rows.map((row) => {
      const money = MoneyValue.fromMinor(row.balance_minor, row.currency);
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        balanceMinor: row.balance_minor,
        balanceFormatted: MoneyValue.format(money, 'ar-SA'),
        currency: row.currency,
        balanceType: row.balance_type,
        reviewState: row.review_state,
      };
    }),
  });
}));
