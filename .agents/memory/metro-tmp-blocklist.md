---
name: Metro _tmp_ blocklist
description: How to prevent Metro's FallbackWatcher from crashing on ephemeral _tmp_ directories created by pnpm packages (multer, expo-document-picker, etc.)
---

## The Problem
Metro's FallbackWatcher walks the entire node_modules tree. Some packages (multer, expo-document-picker) create `<package>_tmp_<pid>` directories during/after install that are deleted before Metro can stat them, causing an ENOENT crash.

## The Fix
In `artifacts/readwell/metro.config.js`, add a regex to `config.resolver.blockList` that matches any path containing `_tmp_<digits>` inside node_modules:

```js
const extra = /node_modules[/\\][^/\\]*_tmp_\d+/;
const existing = config.resolver.blockList;
if (!existing) {
  config.resolver.blockList = extra;
} else if (Array.isArray(existing)) {
  config.resolver.blockList = [...existing, extra];
} else {
  config.resolver.blockList = [existing, extra];
}
```

**Why:** The pattern is broad enough to catch ALL packages that exhibit this behavior — not just multer or expo-document-picker.

**How to apply:** Any time a new package is added to the monorepo that causes Metro to crash with `ENOENT: no such file or directory, watch '…_tmp_…'`, the existing blocklist entry already covers it. No changes needed.
