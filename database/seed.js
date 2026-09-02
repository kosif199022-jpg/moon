#!/usr/bin/env node

import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO organizations (id, legal_name, country_code, audit_framework)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET legal_name = EXCLUDED.legal_name`,
    [organizationId, 'Moon Development Audit Firm', 'SA', 'IFRS']
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, full_name, role, auth_subject)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role`,
    [userId, organizationId, 'manager@example.invalid', 'Development Manager', 'engagement_manager', 'dev:manager']
  );
  await client.query('COMMIT');
  console.log(`Seeded organization ${organizationId} and user ${userId}.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
