---
name: Mobile API and file upload gotchas
description: Why ReadWell mobile builds need the Expo dev domain as API base and React Native file objects for uploads.
---

## Rule

When running the ReadWell Expo app on a physical device:

1. The API base URL must be the same **Expo dev domain** (`$REPLIT_EXPO_DEV_DOMAIN`) that the app bundle is served from, not the workspace dev domain (`$REPLIT_DEV_DOMAIN`). The workspace domain can be blocked or fail to resolve outside the Replit session, while the Expo domain is designed for external device access.
2. Mobile file uploads must use React Native's `{ uri, name, type }` object in `FormData`, not web `File` or `Blob` objects. Hermes/JavaScriptCore does not support `File` construction the way browsers do, and `fetch(uri).blob()` on a local file URI is unreliable.

**Why:** Physical devices reach the workspace dev domain through a different network path than the in-editor web preview, and the web `File`/`Blob` APIs are not fully available in React Native.

**How to apply:** Keep `EXPO_PUBLIC_DOMAIN=$REPLIT_EXPO_DEV_DOMAIN` in the `dev` script, and keep `utils/api.ts` using an `UploadFile` type that maps either a web `File` or a mobile `{uri,name,type}` object into `FormData`.
