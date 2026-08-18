# ReadWell Agent Handoff

Read this file before making changes to the project. It is written for coding
agents continuing work on ReadWell, including Google/Gemini coding agents.
Never add API keys, tokens, passwords, private URLs, or secret values to this
file or any other tracked file.

## Product mission

ReadWell is a Duolingo-style AI reading companion. A reader imports a PDF or
text document, reads it in short sections, answers AI-generated comprehension
questions, and builds a consistent reading habit.

The current product loop is:

```text
Import document → create a book → read a segment/page → generate a quiz →
complete the session → update local progress and achievements
```

## Repository layout

This is a pnpm monorepo:

```text
artifacts/readwell/       Expo 54 mobile app and web preview
artifacts/api-server/     Express API for extraction, PDF rendering, storage, quizzes
artifacts/mockup-sandbox/ Isolated component preview server
lib/api-spec/             OpenAPI source and API code generation
lib/api-zod/              Shared Zod request/response schemas
lib/api-client-react/     Generated React API client
lib/db/                   PostgreSQL/Drizzle package
scripts/                  Workspace helper scripts
```

### Mobile app

The Expo app uses Expo Router. Important areas include:

- `artifacts/readwell/app/` — routes and screens
- `artifacts/readwell/components/` — reader, cards, progress, and shared UI
- `artifacts/readwell/context/AppContext.tsx` — local books, profile, sessions,
  daily activity, quiz cache, and PDF cleanup state
- `artifacts/readwell/utils/api.ts` — server calls, upload objects, and storage
  URL resolution
- `artifacts/readwell/app/import.tsx` — PDF/text selection and import flow
- `artifacts/readwell/components/PdfReader.tsx` — page-image reader and image
  error state

Most user reading state is stored locally with AsyncStorage. The API stores
uploaded files and rendered PDF page images in object storage; there is not
currently a full multi-device account/sync system.

### API server

The API is mounted under `/api` in `artifacts/api-server/src/app.ts`.
Current routes include:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/extract-text` | Extract text from an uploaded file |
| `POST` | `/api/render-pdf` | Render PDF pages, OCR degraded pages, and store images |
| `GET` | `/api/storage/objects/*` | Resolve/read stored public objects |
| `DELETE` | `/api/pdf/pages/:bookId` | Delete rendered PDF pages |
| `POST` | `/api/quiz/generate` | Generate a five-question comprehension quiz |

## Google Gemini setup

Quiz generation uses Google directly through the installed `@google/genai`
package. The implementation is in:

```text
artifacts/api-server/src/routes/quiz.ts
```

Required server-side secret:

```text
GEMINI_API_KEY
```

Optional server-side environment variable:

```text
GEMINI_MODEL
```

If `GEMINI_MODEL` is not set, the app uses `gemini-3.6-flash`. The current Google
API key rejected the older `gemini-2.5-flash` model as unavailable to new
users, so do not casually change the default back to an older model. If Google
changes model availability, override `GEMINI_MODEL` in Replit environment
configuration rather than putting a model or key in the mobile app.

The old `AI_INTEGRATIONS_GEMINI_API_KEY` and
`AI_INTEGRATIONS_GEMINI_BASE_URL` variables may still exist in the workspace,
but quiz generation no longer uses them. Do not delete or rotate environment
values blindly; verify their usage first.

### Gemini safety rules

- Never expose `GEMINI_API_KEY` to Expo, React Native, browser code, logs, or
  error responses.
- Never ask the user to paste a key into chat. Use the workspace secret flow.
- Keep Gemini calls behind the API server.
- Preserve JSON-only quiz output and validate the response before returning it.
- Keep evidence quotes grounded in the supplied passage.
- Consider rate limiting, request-size limits, retries, and cost controls before
  adding batch or automatic AI calls.

## Environment and storage

The API server needs:

- `PORT` — supplied by the Replit artifact workflow; the server fails
  explicitly if missing
- `DATABASE_URL` — runtime-managed PostgreSQL connection string
- `PRIVATE_OBJECT_DIR` — private object-storage directory
- `PUBLIC_OBJECT_SEARCH_PATHS` — comma-separated public object-storage paths
- `GEMINI_API_KEY` — Google Gemini API key
- `GEMINI_MODEL` — optional Gemini model override

The Expo development script supplies:

- `EXPO_PUBLIC_DOMAIN=$REPLIT_EXPO_DEV_DOMAIN`
- `EXPO_PUBLIC_REPL_ID=$REPL_ID`
- `REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_EXPO_DEV_DOMAIN`

Use the Replit Expo development domain for device API calls. Do not hardcode
`localhost` or a guessed workspace URL into mobile code. The API helper uses
`EXPO_PUBLIC_DOMAIN` and falls back to the browser origin only for web preview.

## Mobile upload rules

On native devices, Expo Document Picker returns a local file reference. Upload
it as a React Native FormData object:

```ts
{
  uri: string,
  name: string,
  type: string
}
```

Do not construct a browser `File` or `Blob` for native uploads. Keep
`base64: false` in the document picker request. This avoids the
`Cannot assign to property 'name' which has only a getter` failure.

PDF page URLs may be object paths rather than complete URLs. Resolve them
through `resolveStorageUrl()` in `artifacts/readwell/utils/api.ts`. If a page
image fails, keep the visible reader error state instead of silently showing a
blank page.

## Workflows and commands

Managed workflows:

```text
artifacts/api-server: API Server
artifacts/readwell: expo
artifacts/mockup-sandbox: Component Preview Server
api-server-tests
```

Install from the repo root:

```bash
pnpm install
```

Run the API:

```bash
pnpm --filter @workspace/api-server run dev
```

Run the Expo app:

```bash
pnpm --filter @workspace/readwell run dev
```

Run checks:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/readwell test
pnpm run build
```

After server-side code, dependency, or run-command changes, restart the exact
managed workflow:

```text
artifacts/api-server: API Server
```

Then inspect workflow logs and smoke-test:

```bash
curl -fsS https://$REPLIT_DEV_DOMAIN/api/healthz
```

For a live Gemini smoke test, use a non-sensitive sample passage against
`POST https://$REPLIT_DEV_DOMAIN/api/quiz/generate`. Do not print environment
variables or request/response content that could contain private user text.

## Engineering conventions

- Use pnpm, not npm or Yarn.
- Preserve the existing artifact and monorepo structure.
- Search for existing code and tests before introducing a new abstraction.
- Keep API keys and object-storage credentials server-side.
- Prefer explicit errors and visible recovery UI over silent fallbacks.
- Add or update tests for behavior changes, especially upload, cleanup, and
  quiz error paths.
- Run typecheck and relevant tests before committing.
- Do not replace the object-storage architecture with a different database or
  storage system unless explicitly requested.
- Do not add authentication, payments, or analytics without a clear product
  requirement and a privacy-aware design.

## Current reliability areas

Before starting a new reliability task, check the project task list so work is
not duplicated. Existing work has focused on:

- Interrupted/offline PDF uploads and deletion retry cleanup
- Corrupt local reading data
- Blurry or low-confidence PDF pages
- Non-Latin script detection
- Storage cleanup intervals and orphaned uploads
- Clearer unrecoverable quiz errors
- Per-user PDF storage cost protection

## Recommended agent workflow

1. Read this file and the relevant source files.
2. Search for existing tests and task-list items related to the request.
3. State a short implementation plan.
4. Make the smallest change that satisfies the request.
5. Run typecheck, focused tests, and broader tests when practical.
6. Restart the relevant workflow after server-side changes.
7. Smoke-test the affected endpoint or mobile flow.
8. Review `git diff`, verify no secrets were added, and summarize files changed,
   validation results, and any remaining risks.

## Copy-paste continuation prompt

Use this prompt when handing the project to another coding agent:

> You are continuing work on ReadWell, an Expo 54 mobile reading companion with
> an Express API in a pnpm monorepo. Read `AGENTS.md` and `README.md` first.
> Preserve the existing artifact structure and object-storage architecture.
> Keep `GEMINI_API_KEY` server-side; quiz generation uses the direct Google
> Gemini API through `@google/genai`, with `gemini-3.6-flash` as the default
> model and `GEMINI_MODEL` as an override. Use
> `$REPLIT_EXPO_DEV_DOMAIN`/`EXPO_PUBLIC_DOMAIN` for physical-device API
> connectivity. Before editing, inspect the relevant files and existing tests.
> After editing, run typecheck and focused tests, restart the managed workflow
> when needed, smoke-test the affected flow, and report exactly what changed.
> Do not expose or request credentials in chat.