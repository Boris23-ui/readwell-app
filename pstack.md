# ReadWell pstack Configuration

This document configures the **pstack** (Poteto's Engineering Rigor Stack) for the ReadWell monorepo. pstack provides disciplined, verification-first agent workflows for shipping features with quality and precision.

## What is pstack?

**pstack** (by Lauren Tan / poteto) is a framework of:
- **Agent skills** — specialized capabilities agents can execute
- **Engineering principles** — 21 core principles for rigorous development
- **Verification workflows** — quality-first approach to feature shipping
- **Anti-patterns** — explicit rules to prevent scope creep and unmotivated code

## pstack Principles for ReadWell

### Core Principles

1. **Earn Your Features** — Every feature must solve a real user problem. Features start with evidence, not invention.
2. **Verification First** — Build verification into the workflow. Test before shipping.
3. **Scope Discipline** — Use the "10% scope kill" rule: reduce scope by 10% before each sprint.
4. **Devil's Advocate** — Every plan gets adversarial review before implementation.
5. **Transparency** — Document decisions, trade-offs, and non-obvious changes.

### ReadWell-Specific Context

- **Architecture:** pnpm monorepo with Expo mobile, Express API, TypeScript
- **CI/CD:** Replit-native with auto-deployments
- **Critical paths:** PDF upload → rendering → quiz generation → user progress tracking
- **Constraints:** 
  - Gemini API quotas (rate limits & model availability)
  - Object storage bandwidth
  - Mobile platform fragmentation (iOS/Android)

## pstack Skills for ReadWell

### Verification Skills

- **`verify-architecture`** — Check that changes align with monorepo structure (`artifacts/`, `lib/`, workspace packages)
- **`verify-types`** — Ensure TypeScript compilation passes across all packages
- **`verify-api-contract`** — Validate OpenAPI schema consistency (request/response shapes)
- **`verify-mobile-compat`** — Check that mobile changes work on Expo 54+
- **`verify-storage-ops`** — Confirm PDF/image operations respect object storage constraints
- **`verify-gemini-usage`** — Check that Gemini API calls are within quota and model compatibility

### Engineering Skills

- **`sketch-feature`** — Rapid design doc for the feature (user story, acceptance criteria, non-goals)
- **`plan-implementation`** — Break feature into parallel/sequential tasks with dependency graphs
- **`split-pr`** — Recommend PR-size boundaries (< 300 LOC preferred)
- **`identify-risks`** — List technical risks and mitigation strategies
- **`write-tests-first`** — Generate test suite before implementation

### Review Skills

- **`review-drift`** — Flag changes that do more than declared (scope creep detection)
- **`review-no-slop`** — Ensure no "while we're at it" code
- **`review-api-surface`** — Check that API changes are intentional and backward-compatible
- **`review-mobile-perf`** — Profile bundling, startup time, and memory impact
- **`final-sign-off`** — Checklist before PR merge

## pstack Workflow for ReadWell

### Before Starting a Feature

```
1. Run `verify-gemini-usage` 
   → Check Gemini API quota and feature request compatibility
2. Run `sketch-feature`
   → Write user story, acceptance criteria, non-goals
3. Run `identify-risks`
   → List technical and platform-specific risks
```

### During Implementation

```
1. Run `write-tests-first`
   → Generate test suite before code
2. Run `split-pr`
   → Keep PRs small (< 300 LOC)
3. Implement feature
4. Run `verify-architecture`, `verify-types`, `verify-mobile-compat`
   → Ensure changes are structurally sound
```

### Before Shipping

```
1. Run `review-drift`
   → Ensure no scope creep
2. Run `review-api-surface`
   → Check API changes
3. Run `review-mobile-perf`
   → Profile performance impact
4. Run `final-sign-off`
   → Ready to merge
```

## How to Use pstack in ReadWell

### Install pstack Skills (Cursor/Claude Code/Codex)

If using Claude Code, Codex, or Cursor with pstack support:

```bash
# Claude Code
npx @poteto/pstack-skills install

# Or manually add to your agent config
```

### Manual Workflow

1. **Before PR:** Paste this checklist in your agent prompt:
   ```
   - [ ] Verified API schema consistency
   - [ ] TypeScript compilation passes
   - [ ] Mobile compatibility checked (Expo 54+)
   - [ ] Storage operations respect quota
   - [ ] Gemini API usage is documented
   - [ ] Tests written before code
   - [ ] PR < 300 LOC
   - [ ] No scope creep (drift check)
   - [ ] Backward-compatible API changes
   - [ ] Mobile performance profiled
   ```

2. **During Review:** Use pstack skills as review criteria

3. **After Shipping:** Log what worked, what didn't. Update this doc.

## Integration with AGENTS.md

See [`AGENTS.md`](AGENTS.md) for agent-specific prompts and pstack skill configurations for Claude Code, Codex, and Cursor.

## Future: Multi-Repo pstack

As ReadWell grows and spawns new services (e.g., `readwell-backend`, `readwell-admin`), each repo gets its own pstack config with shared principles.

## References

- **Original pstack (Cursor):** https://github.com/poteto/pstack (MIT)
- **Community ports:** pstack-claude, pstack-codex, pstack-pi, pstack-hermes
- **Lauren Tan (poteto):** https://github.com/poteto
