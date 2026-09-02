import express, { type ErrorRequestHandler } from 'express';
import { pool } from './db.js';
import { asyncRoute, requireUuid } from './http.js';
import { accountRouter } from './routes/accounts.js';
import { engagementRouter } from './routes/engagements.js';
import { AppError, type ActorContext } from './types.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb', strict: true }));
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/health', asyncRoute(async (_request, response) => {
  await pool.query('SELECT 1');
  response.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
}));

app.get('/api', (_request, response) => {
  response.json({
    name: 'Moon API',
    version: '1.0.0',
    endpoints: [
      'POST /api/v1/engagements',
      'GET /api/v1/engagements',
      'GET /api/v1/engagements/:id',
      'PUT /api/v1/engagements/:id/status',
      'POST /api/v1/engagements/:engagementId/accounts',
      'GET /api/v1/engagements/:engagementId/accounts',
    ],
  });
});

app.use('/api/v1', asyncRoute(async (request, response, next) => {
  const organizationId = requireUuid(request.header('X-Organization-ID'), 'X-Organization-ID');
  const userId = requireUuid(request.header('X-User-ID'), 'X-User-ID');
  const membership = await pool.query(
    `SELECT 1 FROM users
      WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
    [userId, organizationId],
  );
  if (!membership.rowCount) {
    throw new AppError(403, 'ACTOR_NOT_AUTHORIZED', 'The active user does not belong to this organization.');
  }
  response.locals.actor = { organizationId, userId } satisfies ActorContext;
  next();
}));

app.use('/api/v1', engagementRouter, accountRouter);
app.use((_request, _response, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found.'));
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? null },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const pgError = error as { code?: string; constraint?: string };
  if (pgError.code === '23505') {
    response.status(409).json({
      error: {
        code: 'DUPLICATE_RECORD',
        message: 'A record with the same unique key already exists.',
        constraint: pgError.constraint ?? null,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
    timestamp: new Date().toISOString(),
  });
};
app.use(errorHandler);
