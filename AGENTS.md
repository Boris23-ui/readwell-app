# Project Agent Guide

ReadWell is a Duolingo-style AI reading companion. This document provides context and workflows for AI coding agents (Antigravity, Claude Code, Codex, Cursor, etc.) working on ReadWell.

## Product goal

ReadWell helps readers build consistent reading habits through AI-generated comprehension quizzes. Users import PDFs or text, read page-by-page, answer quizzes, and track progress.

## Architecture

**Frontend:** Expo 54 mobile app with React Native, Expo Router, TypeScript
**Backend:** Express 5 API server in TypeScript
**Database:** PostgreSQL with Drizzle ORM
**AI:** Google Gemini API (server-side only)
**Storage:** Replit Object Storage for PDFs and rendered page images
**Workspace:** pnpm monorepo with shared libraries

```text
artifacts/
├── api-server/       Express API (PDF extraction, rendering, quizzes)
├── readwell/         Expo mobile app
└── mockup-sandbox/   Component preview

lib/
├── api-client-react/ Generated React API hooks
├── api-spec/         OpenAPI source
├── api-zod/          Shared validation schemas
└── db/               Database schema & helpers
```

## Critical rules

1. **Never expose `GEMINI_API_KEY` to client code** — All Gemini calls go through the Express API server
2. **Keep API keys server-side** — Store in Replit Secrets, never in mobile app or git
3. **Validate TypeScript** — Run `pnpm run typecheck` before shipping
4. **Preserve monorepo structure** — Don't flatten `artifacts/` or `lib/`
5. **Respect object storage quotas** — PDF uploads and page images count toward storage limits
6. **Mobile compatibility first** — Test on Expo 54+ (iOS 15+, Android 7+)
7. **Keep PRs small** — < 300 LOC, focused on one feature
8. **Avoid scope creep** — Every change must solve a declared problem

## Commands

```bash
# Install
pnpm install

# Type checking (all packages)
pnpm run typecheck

# API tests
pnpm --filter @workspace/api-server test

# Mobile tests
pnpm --filter @workspace/readwell test

# Full build
pnpm run build

# Dev API server
pnpm --filter @workspace/api-server run dev

# Dev Expo app
pnpm --filter @workspace/readwell run dev
```

## Workflow

1. **Read first** — Check `AGENTS.md`, `pstack.md`, `README.md`, and relevant source files
2. **Search for precedent** — Look for existing tests and similar implementations
3. **Plan small** — Write acceptance criteria, identify risks, scope ruthlessly
4. **Test first** — Write or update tests before implementation
5. **Keep it bounded** — Make the smallest change that solves the problem
6. **Verify checks** — TypeScript, tests, build, mobile compatibility
7. **Review for drift** — Ensure no unrelated changes snuck in
8. **Ship** — Merge and celebrate

## Safety rules

- Never log or return `GEMINI_API_KEY` or user API keys
- Never ask users to paste secrets in chat — use Replit Secrets
- Validate all file uploads (type, size, format)
- Preserve AsyncStorage data structure in mobile app
- Keep PDF page URLs opaque — resolve through API, not direct object paths
- Test PDF uploads with interruptions (network failures, cancellation)
- Ensure Gemini quiz output is valid JSON before returning to client

## Current focus areas

See the project task list and `AGENTS.md` for ongoing work:
- PDF upload reliability and offline cleanup
- Corrupt local reading data recovery
- Blurry PDF page detection
- Storage cleanup and cost protection
- Quiz error messaging clarity

## Handoff prompt

When handing the project to another agent, use:

> You are continuing work on ReadWell, an Expo 54 mobile reading companion with an Express API in a pnpm monorepo. Read `AGENTS.md`, `pstack.md`, and `README.md` first. Preserve the monorepo structure and object-storage architecture. Keep `GEMINI_API_KEY` server-side. Before editing, inspect relevant files and existing tests. After editing, run typecheck and focused tests, restart managed workflows when needed, smoke-test the affected flow, and report exactly what changed. Do not expose or request credentials in chat.
