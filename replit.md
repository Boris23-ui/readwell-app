# ReadWell

ReadWell is a Duolingo-style AI reading companion that helps readers build consistent reading habits through AI-generated comprehension quizzes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/readwell run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env for API: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (in Replit Secrets)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo 54, React Native, Expo Router
- API: Express 5
- DB/Auth: Supabase (Postgres) accessed via `@supabase/supabase-js`
- Storage: Replit Object Storage
- AI: Google Gemini API

## Where things live

- **App:** `artifacts/readwell/` (Expo project)
- **API:** `artifacts/api-server/` (Express project)
- **Blueprint:** `docs/blueprint.md` (Product vision and requirements)

## Architecture decisions

- **Mobile First:** Focus on iOS/Android via Expo.
- **Direct DB Access:** The mobile app calls Supabase directly for authentication, goals, and simple data.
- **Secure API server:** API keys for Gemini and object storage live strictly in the Express API server.
- **Coach Memory:** The Coach memory uses Supabase to persist user conversations, strategies, and flashcards.

## Product

Users can upload PDFs, read them segment by segment, and answer automatically generated comprehension checks. The AI coach tracks performance and adapts.

## User preferences

- Stick to the `implementation_plan.md` track.
- Prefer smaller, incremental PR-sized changes.
- Avoid introducing database migrations unless strictly required.

## Gotchas

- Do not expose `GEMINI_API_KEY` to the Expo client app.
- When generating quizzes, the response must be validated to ensure evidence quotes exist in the text.
- Do not add features outside the `implementation_plan.md` without confirmation.
