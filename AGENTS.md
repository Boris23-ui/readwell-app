# Project Agent Guide

ReadWell is a Duolingo-style AI reading companion. This document provides context and workflows for AI coding agents (Antigravity, Claude Code, Codex, Cursor, etc.) working on ReadWell.

## Product goal

ReadWell helps readers build consistent reading habits through AI-generated comprehension quizzes. Users import PDFs or text, read page-by-page, answer quizzes, and track progress.

## Architecture

- Frontend: Expo 54 mobile app with React Native, Expo Router, TypeScript
- Backend: Express 5 API server in TypeScript
- Database: PostgreSQL with Drizzle ORM
- AI: Google Gemini API, server-side only
- Storage: Replit Object Storage for PDFs and rendered page images
- Workspace: pnpm monorepo with shared libraries

## Critical rules

1. Never expose `GEMINI_API_KEY` to client code; Gemini calls go through the Express API.
2. Keep API keys in Replit Secrets, never in the mobile app or git.
3. Run `pnpm run typecheck` before shipping.
4. Preserve the `artifacts/` and `lib/` monorepo structure.
5. Respect object-storage quotas for PDF uploads and rendered page images.
6. Test mobile changes on Expo 54+ for iOS and Android.
7. Keep changes focused and reviewable; prefer less than 300 changed lines.
8. Avoid scope creep and unrelated cleanup.

## Commands

```bash
pnpm install
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/readwell test
pnpm run build
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/readwell run dev
```

## Workflow

1. Read `AGENTS.md`, `pstack.md`, `README.md`, and relevant source files.
2. Search for existing tests and similar implementations.
3. Define acceptance criteria, non-goals, and risks.
4. Write or update tests before implementation when behavior changes.
5. Make the smallest change that solves the declared problem.
6. Run typecheck, focused tests, and the full build when practical.
7. Review the diff for scope drift, secrets, and regressions.
8. Report files changed, validation results, and remaining risks.

## Safety rules

- Never log or return `GEMINI_API_KEY` or user secrets.
- Never ask users to paste credentials into chat.
- Validate file uploads for type, size, and format.
- Preserve AsyncStorage data structures in the mobile app.
- Resolve PDF page paths through the API rather than exposing storage paths.
- Preserve abortable uploads and cleanup retry behavior.
- Validate Gemini output as JSON before returning it to clients.

## Handoff prompt

> You are continuing work on ReadWell, an Expo 54 reading companion with an Express API in a pnpm monorepo. Read `AGENTS.md`, `pstack.md`, and `README.md` first. Preserve the monorepo structure and object-storage architecture. Keep `GEMINI_API_KEY` server-side. Inspect relevant files and tests before editing. After editing, run typecheck and focused tests, smoke-test affected flows, and report exactly what changed. Do not expose or request credentials.
