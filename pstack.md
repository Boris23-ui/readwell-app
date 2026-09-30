# pstack for ReadWell

ReadWell uses pstack-style, verification-first delivery adapted for Antigravity and other repo-driven agents. This file is guidance, not a package installation.

## Principles

- Earn features with a clear user problem and evidence.
- Verify before shipping.
- Reduce scope before implementation.
- Challenge plans with a devil's-advocate review.
- Avoid "while we're at it" work.
- Document decisions and trade-offs.

## ReadWell risks

- Gemini quotas, model availability, latency, and cost.
- Object-storage bandwidth and orphaned PDF/page files.
- iOS/Android differences in uploads and rendering.
- Monorepo package coupling and API contract drift.
- Backward-compatible database migrations.

## Before implementation

- State the user problem and acceptance criteria.
- List explicit non-goals.
- Identify API, database, storage, Gemini, and mobile risks.
- Decide the smallest implementation and split large work into focused changes.
- Confirm whether OpenAPI, Zod schemas, generated hooks, or migrations need updates.

## During implementation

- Add or update tests before changing behavior where practical.
- Preserve the Expo upload shape `{ uri, name, type }` on native devices.
- Keep Gemini calls behind the API server.
- Preserve abortable uploads, cleanup retries, and visible error states.
- Avoid unrelated refactors and dependency additions.

## Before shipping

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/readwell test
pnpm run build
```

Then review the diff:

- [ ] Acceptance criteria are met.
- [ ] No scope drift or unrelated cleanup.
- [ ] No secrets or private data are exposed.
- [ ] API/OpenAPI/Zod/generated client changes are consistent.
- [ ] Database changes are backward-compatible.
- [ ] PDF and storage behavior is safe and quota-aware.
- [ ] Gemini output and error handling are validated.
- [ ] Expo 54 iOS/Android behavior is considered.
- [ ] Focused tests and build pass.
- [ ] Remaining risks are documented.

## Anti-patterns

### Client-side Gemini keys

Never put `GEMINI_API_KEY` in Expo, browser code, logs, or error responses. Use the server-side secret flow.

### Scope creep

A PDF annotation feature does not automatically include sharing, voice notes, or collaboration. Record those as separate future work.

### Monolithic changes

Split database/API, mobile UI, integration, and optimization work into separately reviewable changes when possible.

### Unverified shipping

Do not push based on hope. Run typecheck, relevant tests, build, and an affected-flow smoke test.

## Antigravity usage

Antigravity should read `AGENTS.md` and this file before editing. When a request is ambiguous, ask for the missing product requirement rather than inventing behavior. When a task touches AI, uploads, storage, or mobile behavior, explicitly include the relevant risk review in the implementation summary.

## References

- Original pstack: https://github.com/poteto/pstack
- ReadWell agent guide: [`AGENTS.md`](AGENTS.md)
- ReadWell project guide: [`README.md`](README.md)
