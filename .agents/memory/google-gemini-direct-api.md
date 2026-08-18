---
name: Google Gemini direct API
description: Provider and model conventions for ReadWell quiz generation.
---

ReadWell quiz generation uses Google's Gemini API directly through the
server-side `@google/genai` client. The API key must remain in the server
secret `GEMINI_API_KEY`; the mobile app must only call ReadWell's `/api` route.
The default model is configurable with `GEMINI_MODEL` and currently defaults to
`gemini-3.6-flash`.

**Why:** The project owner chose Google AI Pro and its API for ongoing quiz
generation. A direct client avoids coupling app behavior to Replit's managed
Gemini proxy, and the Google API reported that older default models were
unavailable for this key.

**How to apply:** Keep Google credentials server-only, use the direct
`GoogleGenAI({ apiKey })` client, and treat `GEMINI_MODEL` as the deployment
override when Google changes model availability. Treat model output as
untrusted: keep input bounded, validate the expected five-question shape, and
use bounded retries, timeouts, and rate limits so a transient AI failure does
not become an uncontrolled cost or a broken quiz.