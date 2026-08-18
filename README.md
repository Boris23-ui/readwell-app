# ReadWell

ReadWell is a Duolingo-style AI reading companion. Import a PDF or text
document, read it page by page, and use generated quizzes to check
understanding while building a consistent reading habit.

The project is split into an Expo mobile app and an Express API server in a
pnpm monorepo.

## Repository

Public GitHub repository: <https://github.com/Boris23-ui/readwell-app>

For coding-agent context, architecture decisions, workflows, and safe Gemini
API usage, see [`AGENTS.md`](AGENTS.md).

## Tech stack

- **Mobile app:** Expo 54, React Native, Expo Router, TypeScript
- **API:** Express 5, TypeScript, OpenAPI-generated client and Zod schemas
- **AI:** Google Gemini API
- **Storage:** Replit Object Storage for uploaded PDFs and rendered page images
- **Workspace:** pnpm workspaces and Node.js 24

## Project structure

```text
artifacts/
├── api-server/       Express API for extraction, PDF rendering, storage, and quizzes
├── mockup-sandbox/   Isolated component preview server
└── readwell/         Expo mobile application
lib/
├── api-client-react/ Generated React API hooks
├── api-spec/         OpenAPI source and code generation
├── api-zod/          Shared API validation schemas
└── db/               Database package and schema helpers
```

## Prerequisites

- Node.js 24
- pnpm
- Expo Go on a physical iOS or Android device, if testing the mobile app
- A configured Replit environment with:
  - a PostgreSQL database
  - Replit Object Storage
  - a Google Gemini API key, such as one created in Google AI Studio

Install dependencies from the repository root:

```bash
pnpm install
```

## Run the API server

The API server requires `PORT`. In Replit, the configured API workflow supplies
it automatically:

```bash
pnpm --filter @workspace/api-server run dev
```

The health endpoint is:

```text
GET /api/healthz
```

For a local shell outside the Replit workflow, provide a port explicitly:

```bash
PORT=5000 pnpm --filter @workspace/api-server run dev
```

PDF uploads also require the server's object-storage variables:

- `DATABASE_URL`
- `PRIVATE_OBJECT_DIR`
- `PUBLIC_OBJECT_SEARCH_PATHS`

Quiz generation calls Google's Gemini API directly. Keep the API key on the
server:

- `GEMINI_API_KEY` — required Google Gemini API key
- `GEMINI_MODEL` — optional model name; defaults to `gemini-3.6-flash`

Create or manage the key in Google AI Studio, then add it to the Replit
Secrets manager as `GEMINI_API_KEY`. A Google AI Pro subscription can be used
with the Google Gemini API, but API usage and quotas are still governed by the
Google AI API project associated with the key.

Do not commit these values or put them in the mobile app bundle.

## Run the Expo app

Start the mobile app with the repository's configured Expo workflow:

```bash
pnpm --filter @workspace/readwell run dev
```

The script automatically uses `$REPLIT_EXPO_DEV_DOMAIN` for the API and Metro
proxy so a physical device can reach the running workspace. Open the generated
Expo QR code with Expo Go.

For web-only preview:

```bash
pnpm --filter @workspace/readwell exec expo start --web
```

When importing a document on a device, the app sends the selected local file
using React Native's `{ uri, name, type }` upload shape. Keep the Expo
development server and API server running while testing imports and PDF page
images.

## Checks

Run the full workspace typecheck:

```bash
pnpm run typecheck
```

Run the API tests:

```bash
pnpm --filter @workspace/api-server test
```

Run the ReadWell tests:

```bash
pnpm --filter @workspace/readwell test
```

Build all packages:

```bash
pnpm run build
```

## Development notes

- Use pnpm rather than npm or Yarn; the repository enforces this during
  installation.
- API routes are mounted under `/api`.
- PDF pages are rendered and stored on the server. The mobile app resolves
  stored object paths through the API rather than assuming the object URL is
  directly public.
- Keep uploaded files and generated page images in object storage; do not add
  them to Git.

## License

This project is currently distributed without a separate open-source license
file. Add a `LICENSE` file before accepting external contributions under
specific reuse terms.