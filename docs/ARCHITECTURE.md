# Moon architecture baseline

Moon is an Arabic-first audit operating system. The product interface orchestrates the engagement while deterministic engines remain separate from generative AI.

## Decision boundaries

- Money is represented in minor units with `bigint`; floating-point arithmetic is not used for financial decisions.
- Materiality, risk scoring, journal-entry flags, sampling, misstatement aggregation, and the ISA 705 opinion path are deterministic and versioned.
- AI may draft, summarize, challenge, and propose. It may not approve gates, determine amounts, mark evidence accepted, or override the derived opinion.
- Critical transitions require a named human actor, role authorization, rationale, timestamp, and an append-only audit event.
- Every computed artifact carries provenance: source identifiers, engine and version, input hash, generation time, actor, and review state.

## Repository layers

- `public/index.html`: complete browser demonstration and deterministic engine reference implementation.
- `packages/domain`: reusable TypeScript value objects and audit entities.
- `apps/api`: Phase 1 service boundary for engagements and trial-balance accounts.
- `database`: PostgreSQL schema, migration runner, and development seed.

The browser demonstration is intentionally self-contained. Production deployment should move persistence and authorization to the API while preserving the same engine contracts and regression results.
