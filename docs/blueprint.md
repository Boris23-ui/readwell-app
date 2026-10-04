# ReadWell — Product Blueprint
### An AI reading companion that makes deep reading enjoyable, measurable, and habit-forming

Working name: **ReadWell** (alternatives: Paged, Lumina, DeepRead). Rename freely — the blueprint is name-agnostic.

---

## 1. Product Vision

**Plain-English concept:** ReadWell is a mobile app that turns any book, PDF, or article into a guided reading session. While you read, an optional, on-device camera check quietly confirms you're actually engaged (eyes on page, not scrolling elsewhere). Every 5 paragraphs, the app asks 5 short AI-generated questions about what you just read. You earn a Focus Score, a Comprehension Score, XP, and streaks. Over weeks, the app becomes a reading coach: it knows your pace, your weak spots, and what keeps you hooked — and it uses that to keep you reading.

**The one-line pitch:** Duolingo made language learning a daily habit; ReadWell does the same for deep reading.

**The founder's framing of the problem:** Attention is the scarce resource. Short-form content wins because it delivers reward every 8 seconds; books deliver reward every 8 pages. ReadWell shortens the reward loop of reading without cheapening the book — checkpoint quizzes, visible progress, and social accountability give readers a dopamine cadence that competes with the feed.

**Non-negotiable design principle:** The camera is a *coach*, not a *monitor*. All attention detection runs on-device, no video ever leaves the phone, and the feature is opt-in with a one-tap kill switch. If the camera feature ever feels like surveillance, we've failed.

---

## 2. Value Proposition

**One sentence:** ReadWell helps you read more books and actually remember them, by combining a distraction-aware reading mode, instant comprehension checks, and a habit engine that makes finishing a chapter feel as rewarding as clearing a level.

Per audience:
- **Students:** "Prove to yourself (and your teacher) that you read it and understood it."
- **Young adults:** "Replace 30 minutes of scrolling with 30 minutes of reading — and see the streak grow."
- **Parents:** "Know your child read, focused, and understood — without hovering."
- **Schools/libraries:** "Reading engagement analytics that actually measure comprehension, not just pages turned."

---

## 3. Target Users & Personas

**Persona 1 — Amina, 16, high school student (Nairobi).**
Pain: assigned reading feels like a chore; she rereads the same page 3 times because her mind wanders to her phone. Wants: focus help, quick checks that she "got it," and proof of work for school.
Killer feature for her: Focus Mode + auto-generated quiz she can show as a reading log.

**Persona 2 — Daniel, 24, junior developer.**
Pain: buys books, reads 40 pages, abandons them; screen time report embarrasses him. Wants: a habit system with streaks and friends. Killer feature: streaks, XP, friend reading circles, "read 20 min/day" quests.

**Persona 3 — Grace, 38, parent of two (ages 8 and 12).**
Pain: kids say they read but retention is zero; she can't sit with them every evening. Wants: a supervised mode with age-appropriate quizzes and a weekly report. Killer feature: Family mode with parent dashboard.

**Persona 4 — Mr. Otieno, 45, school librarian.**
Pain: reading programs measure "books checked out," not reading. Wants: class-level dashboards, assignable passages, comprehension trends. Killer feature: Educator portal with class codes and CSV export.

**Persona 5 — Sarah, 52, lifelong learner.**
Pain: reads a lot but forgets everything within a month. Wants: retention. Killer feature: spaced-repetition review of past quiz questions ("Weekend Recap").

**MVP focus decision:** Build for Personas 1 and 2 first (self-motivated readers, 15–30). Parents and schools are v2 — they buy, but they need admin surfaces that would slow the MVP by months.

---

## 4. MVP Features (ship in 12–16 weeks)

**Reading core**
1. Account creation (email + Google/Apple sign-in).
2. Content ingestion: upload PDF or EPUB; paste article URL or text. (No licensed bookstore in MVP — users bring their own content. This dodges licensing entirely.)
3. Paragraph chunking pipeline: content is split into paragraphs and grouped into "segments" of 5.
4. Distraction-free reader: clean typography, dark mode, font size/spacing controls, progress bar, offline reading of downloaded content.

**Focus (camera)**
5. Optional camera-based attention check: on-device face/gaze presence detection sampled a few times per minute (not continuous video analysis). Output is a single number per session — no images stored, nothing uploaded.
6. Focus Score per session + gentle nudges ("You drifted for 2 minutes — want a 30-second break?").

**Comprehension**
7. AI quiz engine: after each 5-paragraph segment, 5 questions (2 recall, 1 vocabulary-in-context, 1 inference, 1 reflection). Multiple-choice + one short free-text.
8. Instant feedback with the relevant sentence quoted back ("Here's where the text said this").

**Habit & progress**
9. Streaks, XP, levels, 6–8 launch badges.
10. Daily goal (minutes or pages), reading reminders (local notifications).
11. Dashboard: books in progress, pages read, comprehension %, focus %, streak, weekly chart.

**Explicitly cut from MVP:** bookstore/catalog, social feed, leaderboards, parent/teacher mode, read-aloud/TTS, iPad/tablet layouts, Android widget, spaced repetition. All are v2+.

## 5. Advanced Features

**Version 2 (months 4–9)**
- **Family & Educator mode:** child profiles, parent dashboard, class codes, assignable passages, weekly email reports.
- **Social layer:** friend circles (max ~12 people), shared quests ("Our circle reads 500 pages this month"), opt-in leaderboards, chapter discussion threads.
- **Spaced repetition:** missed quiz questions resurface after 2, 7, and 30 days ("Weekend Recap").
- **Adaptive difficulty:** question difficulty and segment length adjust to reading level (start with 5 paragraphs; strong readers get longer segments, struggling readers shorter).
- **Read-aloud / TTS** with synchronized highlighting; dyslexia-friendly fonts.
- **Book recommendations** based on completion patterns, quiz performance, and stated interests.

**Future vision (year 2+)**
- Licensed content partnerships (public-domain first: Project Gutenberg ingestion at launch is cheap and legal; commercial publishers later).
- "Discuss this chapter" AI companion — Socratic conversation, not answers.
- Reading-behavior coach: "You slow down 40% in the evenings — your comprehension is best at 7am."
- School district / national literacy program deployments with offline-first sync (relevant for African and South Asian markets where connectivity is intermittent).
- Web + tablet apps; physical-book mode (camera OCRs the page you photograph, quizzes you on it — this is a genuinely differentiated feature).

---

## 6. Screen Map (MVP)

**Onboarding (5 screens)**
1. Welcome / value pitch
2. Sign up / sign in
3. Reader profile: age band, reading level self-assessment, interests, daily goal
4. Camera consent screen (dedicated, plain-language, skippable — "You can turn this on later")
5. Notification permission + first-book prompt

**Core (9 screens)**
6. Home: current book, streak flame, daily goal ring, "Continue reading" CTA
7. Library: my uploads, in-progress, finished
8. Import: file picker / URL paste / text paste, with processing state
9. Reader: the reading surface (paragraph-tracked scrolling, segment progress dots, focus indicator as a subtle icon, pause button)
10. Quiz: 5 questions, one per card, progress dots
11. Quiz results: score, quoted evidence for wrong answers, XP earned animation
12. Session summary: time, pages, focus score, comprehension score, streak update
13. Dashboard/Stats: weekly chart, totals, badges
14. Profile & Settings: goals, camera toggle, dark mode, data controls (export/delete)

**System (3 screens)**
15. Paywall (soft, post-value: shown after first finished book)
16. Camera privacy explainer ("What we see, what we never store")
17. Empty/error/offline states (designed, not default)

Total: ~17 screens. That is a 12–16 week MVP for a small team, not a 6-week one — the reader and quiz engine are the hard parts.

---

## 7. User Flows

**Onboarding flow**
Welcome → sign up → profile (age, level, interests, goal) → camera consent (default OFF, explained) → notifications → "Add your first book" → import → reader tutorial overlay (3 tips) → first session. *Decision: get the user reading within 3 minutes of install. Every extra onboarding screen costs ~10% activation.*

**Reading session flow**
Home → Continue reading → (if camera enabled: 1-second calibration, subtle green dot confirms) → read segment of 5 paragraphs → segment boundary reached → soft chime + "Quick check?" card (user can defer once per segment — never force mid-flow) → quiz → results with evidence quotes → +XP → next segment or "End session" → session summary → streak/badge celebration if earned.

**Quiz flow**
Q1–Q5 as swipeable cards → answer → instant right/wrong with the source sentence highlighted → free-text question graded by AI with 1-line feedback → results screen: score out of 5, comprehension trend sparkline, "Review misses" option.

**Rewards flow**
XP added at session end (not per question — reduces gaming) → level-up modal at thresholds → badge unlock animations → streak screen at day milestones (3, 7, 14, 30, 100) with a "streak freeze" earnable item (one per week of consistent reading — forgiveness mechanics are what make streaks retain instead of churn).

**Progress tracking flow**
Dashboard → weekly view (default) → tap metric for detail → comprehension by book → focus by time of day → shareable weekly recap card (image export — this is the organic growth loop).

---

## 8. Technical Architecture

**Framework decision: React Native (Expo).**
Reasons: (1) your team's likely hiring pool (JS/TS) is deeper than Dart; (2) Expo's dev-build workflow now supports the native modules we need (VisionCamera, MediaPipe bindings); (3) OTA updates via EAS Update let you iterate on quiz UX without app-store review; (4) Flutter's rendering edge matters for games, not for a text reader. Choose Flutter only if your founding engineers already know it — team fluency beats framework benchmarks.

**High-level architecture**

```
Mobile app (React Native + Expo)
 ├─ Reader engine (paragraph tracking, offline cache via SQLite/MMKV)
 ├─ Attention module (on-device: VisionCamera frame processor + MediaPipe
 │   FaceLandmarker → gaze/presence heuristic → emits focus events only)
 ├─ Quiz UI + local queue (works offline, syncs later)
 └─ Sync layer (background sync of events/scores)

Backend (Supabase: Postgres + Auth + Storage + Edge Functions)
 ├─ Auth (email, Google, Apple)
 ├─ Content ingestion service (Edge Function or small Node service):
 │   PDF/EPUB/HTML → text extraction → paragraph chunking → segments
 ├─ Quiz generation service: segment text → LLM API → 5 validated questions
 ├─ Scoring & progress APIs (Postgres functions / REST)
 └─ Storage (uploaded files, private buckets)

AI layer
 ├─ Question generation: hosted LLM API (e.g., GPT-4o-mini / Gemini Flash /
 │   Llama via Groq — pick on cost; questions are a cheap, well-bounded task)
 ├─ Free-text answer grading: same model, rubric prompt
 └─ Recommendations (v2): embeddings + pgvector in the same Postgres

Analytics: PostHog (self-serve, generous free tier, mobile SDK)
Crash/monitoring: Sentry
Payments: RevenueCat (wraps App Store + Play Billing)
Notifications: Expo Notifications (local for reminders; push later)
```

**On-device vs cloud — the explicit split**
- On-device, always: camera frames, face landmarks, gaze inference, focus scoring. Only aggregate numbers (`focus_score`, `distraction_events_count`) sync to the cloud. This is both the privacy story and the bandwidth story.
- Cloud: text extraction, question generation, free-text grading, cross-device sync, analytics.
- Offline mode: downloaded books + pre-generated quizzes for the next 3 segments are cached, so a reader on a bus with no data still gets the full loop; results sync when online. (Pre-generating upcoming quizzes at import time or session start is the key trick.)

**Service boundaries (APIs)**
1. `POST /content` — upload/URL → returns `content_id`, processing status
2. `GET /content/:id/segments` — chunked paragraphs, paginated
3. `POST /segments/:id/quiz` — returns 5 questions (or serves pre-generated)
4. `POST /quiz/:id/answers` — grades, returns feedback + scores
5. `POST /sessions` / `PATCH /sessions/:id` — session lifecycle, focus events
6. `GET /me/progress` — dashboard aggregates
7. v2: `GET /me/recommendations`, `POST /classes`, `GET /classes/:id/report`

**Cost control decision:** cache generated quizzes by `segment_hash`. Two users reading the same public-domain chapter share one generation. For popular content your marginal AI cost per reader trends toward zero.

---

## 9. Database Schema (Postgres)

Core entities and relationships:

```sql
users(id, email, display_name, age_band, reading_level, interests jsonb,
      daily_goal_minutes, camera_enabled bool default false,
      xp int, level int, streak_current int, streak_best int,
      streak_freeze_count int, created_at)

contents(id, owner_id → users, title, author, source_type
         enum('pdf','epub','url','text','gutenberg'),
         storage_path, language, word_count, status
         enum('processing','ready','failed'), content_hash, created_at)

segments(id, content_id → contents, index int, paragraph_start int,
         paragraph_end int, text_excerpt_hash, word_count)
-- raw paragraph text lives in storage/JSON per content, not per-row,
-- to keep the hot table small

quizzes(id, segment_id → segments, model_version, questions jsonb,
        segment_hash unique, created_at)
-- questions jsonb: [{type, prompt, options[], correct_index,
--                    evidence_quote, difficulty}]

reading_sessions(id, user_id, content_id, started_at, ended_at,
                 seconds_read int, paragraphs_read int,
                 focus_score numeric,          -- 0..100, computed on device
                 distraction_events int, device_offline bool)

quiz_attempts(id, user_id, quiz_id, session_id, answers jsonb,
              score int,                        -- 0..5
              free_text_feedback text, completed_at)

user_content_progress(user_id, content_id, last_paragraph int,
                      percent_complete, comprehension_avg,
                      finished_at, primary key(user_id, content_id))

badges(id, key, name, criteria jsonb)
user_badges(user_id, badge_id, earned_at)

daily_activity(user_id, date, minutes_read, xp_earned, goal_met bool,
               primary key(user_id, date))   -- powers streaks & charts
```

v2 additions: `families`, `family_members(role)`, `classes`, `class_members`, `assignments`, `friend_circles`, `circle_members`, `review_items` (spaced repetition), `recommendation_events`.

Relationships: users 1→N contents, sessions, attempts; contents 1→N segments; segments 1→1..N quizzes (versioned by model); everything time-series lands in `daily_activity` for cheap dashboard queries.

---

## 10. AI Logic

**Question generation pipeline**
1. At import (or session start), the chunker produces segments of 5 paragraphs (~150–400 words each; merge tiny paragraphs, split giant ones at sentence boundaries — dialogue-heavy fiction needs this).
2. For each segment, one LLM call with a strict JSON-schema prompt produces exactly 5 questions with a fixed mix:
   - **Q1–Q2 Recall:** "What did X do when…?" — answer must be quotable from the text.
   - **Q3 Vocabulary/meaning in context:** "In this passage, 'reluctant' most nearly means…"
   - **Q4 Inference:** "Why did the author likely mention…?" — supported but not stated.
   - **Q5 Reflection (free text, 1–2 sentences):** "Do you agree with the character's choice? Why?"
3. Each MCQ must include an `evidence_quote` — the exact sentence supporting the correct answer. This is your hallucination firewall: a validator checks the quote actually appears in the segment; if not, regenerate. Also validate: exactly 4 options, one correct, distractors plausible, no meta-references ("according to paragraph 3").
4. Difficulty parameter (from user's reading level + rolling comprehension average) adjusts vocabulary and inference depth.
5. Free-text grading: second small LLM call with a 3-point rubric (addresses the question / references the text / coherent), returns score + one encouraging feedback line. Never punitive language — the model is prompted as a coach.

**Model choice:** a small, cheap, fast model (Gemini Flash-class or GPT-4o-mini-class) is fully sufficient — this is constrained extraction, not open-ended reasoning. Budget roughly fractions of a cent per segment; with segment-hash caching, cost scales with unique content, not users.

**Attention detection (on-device)**
- MediaPipe FaceLandmarker (runs at 5–10 fps sampled bursts, not continuously) → signals: face present, head pose within reading range, eyes open, gaze roughly downward-toward-device.
- A simple state machine, not ML training: `ENGAGED` / `GLANCED_AWAY` (<5s, ignore) / `DISTRACTED` (>15s away) / `ABSENT`. Focus Score = engaged time ÷ session time, with glances forgiven.
- Explicit decision: do **not** attempt emotion detection, identity verification, or attention "quality" claims. Presence + orientation is honest, achievable, and defensible; anything more is snake oil and a privacy liability.
- Battery guardrail: sample 2 seconds of frames every 20 seconds; suspend sampling below 20% battery.

---

## 11. Gamification & Scoring System

**The four scores**
- **Comprehension Score:** rolling average of quiz scores (last 20 quizzes, recency-weighted). Shown as %, with trend arrow.
- **Focus Score:** per-session from the attention module; users without camera get a proxy from scroll-cadence regularity (so camera-off users aren't second-class).
- **Consistency:** streak (days meeting daily goal) + weekly goal-met count.
- **Growth:** comprehension trend over 30 days — celebrated more than absolute score, so weaker readers still win. *This is the learning-scientist decision that keeps the app motivating instead of demoralizing.*

**XP economy (concrete numbers to start)**
- 1 XP per minute read (capped 60/day to prevent grinding)
- 10 XP per quiz, +2 per correct answer, +5 bonus for 5/5
- 25 XP for meeting daily goal; 100 XP for finishing a book
- Levels: 1→2 at 100 XP, thresholds ×1.4 per level. Levels unlock cosmetic themes for the reader (fonts, page textures) — rewards that honor reading rather than infantilize it.

**Badges (launch set):** First Book Finished · 7-Day Flame · Perfect Quiz ×10 · Night Owl / Early Bird · Genre Explorer (3 genres) · Comeback (returned after 7+ days away — reward the return, don't shame the lapse).

**Quests:** weekly rotating ("Read 100 minutes", "Complete 8 quizzes", "Try a new genre"). Kept short and finishable — abandoned quests are worse than no quests.

**Anti-childishness rules:** no cartoon mascot for adults (age-band-gated visual language), no loss aversion mechanics beyond the streak, no pay-to-restore-streak (earn freezes by reading), muted celebration animations with a "minimal mode" toggle.

---

## 12. Privacy & Ethics

**Camera principles (published as a plain-language page in-app)**
1. Opt-in, default off, one-tap off forever; the app is fully functional without it.
2. All processing on-device. Frames are analyzed in memory and discarded; no image or video is ever stored or transmitted. Only numeric focus summaries sync.
3. A visible indicator whenever sampling is active; no background camera use, ever.
4. Data controls: export all my data, delete all my data, delete camera-derived data separately — all self-serve in Settings.
5. Independent claim: put "no images leave your device" in the privacy policy where it's legally binding, not just marketing.

**Minors:** age gate at signup; under-13 (or local equivalent) requires parent-created profile (v2 Family mode) — in MVP, under-13 simply can't register. Camera feature for minors requires explicit parental consent in Family mode. COPPA/GDPR-K/Kenya DPA compliance review before v2 ships.

**Ethical guardrails:** never rank children publicly by comprehension; leaderboards are opt-in and effort-based (minutes, streaks) rather than ability-based; quiz failure language is always coaching ("Let's look at that part again"), never judgment; teachers see class aggregates by default, individual drill-down only with a stated educational purpose.

**Moderation:** uploaded content is user-private in MVP (no sharing = no moderation surface). When social features ship, discussion threads get standard text moderation + report/block.

---

## 13. Monetization

**Consumer (launch): freemium subscription.**
- Free: 1 active book, quizzes on the first 3 segments/day, basic stats, streaks.
- Plus (~$4.99/mo, regionally priced — e.g., KES-appropriate pricing in Kenya; use App Store regional tiers): unlimited books & quizzes, full dashboard, spaced-repetition review, offline packs, cosmetic themes.
- Decision: the paywall gates *volume*, never the habit loop — free users keep streaks and daily reading so the network and habit grow.

**Family (v2):** family plan ~$7.99/mo for up to 5 profiles + parent dashboard + weekly reports. Parents are the highest-willingness-to-pay segment.

**Schools/libraries (v2/v3):** per-seat annual licensing (e.g., $2–4/student/year at volume), educator portal, assignment tools, CSV/LMS export. Sell to reading programs and NGOs; in African markets, literacy NGOs and donor-funded programs are a real early channel.

**Never:** ads inside the reading experience, selling reading data, pay-to-win comprehension boosts.

---

## 14. Launch Roadmap

**Phase 0 — Validation (weeks 1–4, before heavy build)**
Build a Wizard-of-Oz prototype: a simple web reader + manually/LLM-generated quizzes for 3 public-domain books. Recruit 20 target users (your own campus is perfect). Measure: do people complete quizzes? Does the 5-paragraph cadence annoy or delight? Adjust segment length now, cheaply.

**Phase 1 — MVP build (weeks 5–16)**
The Section-4 scope. Milestones: reader + chunker (wk 8) → quiz engine end-to-end (wk 11) → camera module behind a flag (wk 13) → gamification + dashboard (wk 15) → closed beta (wk 16).

**Phase 2 — Closed beta (weeks 17–22)**
100–300 users via campus clubs, book communities, one partner school for observation only. North-star metric: **% of users with a 7-day reading streak in their first 3 weeks** (target ≥ 20%). Secondary: quiz completion rate ≥ 70%, D30 retention ≥ 15%, camera opt-in ≥ 40%.

**Phase 3 — Public launch (weeks 23–28)**
App Store + Play Store, Product Hunt, BookTok/Bookstagram creators (the shareable weekly-recap card is the growth asset), Gutenberg starter library so new users can start in 30 seconds without owning an ebook.

**Phase 4 — v2 (months 7–12)**
Family mode → Educator portal → social circles → spaced repetition, sequenced by what beta data says drives retention.

**Clickable step-by-step MVP order for the builder:** 1) Auth + profile → 2) text/URL import + chunker → 3) reader with paragraph tracking → 4) quiz generation + quiz UI → 5) scoring + session summary → 6) streaks/XP/badges → 7) dashboard → 8) camera module → 9) offline cache → 10) paywall. Each step is demoable on its own; the camera is deliberately step 8, not step 1 — the habit loop must work without it.

---

## 15. Risks & Mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Camera feels creepy → uninstalls | High | Opt-in default-off, on-device only, visible indicator, app fully works without it; lead marketing with quizzes/habit, not camera |
| Quizzes feel like school → churn | High | Deferrable checks, coaching tone, reflection questions, "minimal mode"; tune cadence from beta data (maybe 5 paragraphs is wrong — let data decide) |
| LLM generates bad/hallucinated questions | Medium | Evidence-quote validation, JSON schema enforcement, regeneration loop, user "flag question" button feeding an eval set |
| AI cost blowup | Medium | Segment-hash caching, small models, pre-generation batching, per-user daily generation caps on free tier |
| Content licensing exposure | Medium | MVP = user uploads + public domain only; no redistribution; publisher deals only with counsel, later |
| Battery drain from camera | Medium | Burst sampling (2s per 20s), low-battery suspend, publish measured drain numbers |
| Child-privacy regulation (COPPA/GDPR-K/Kenya DPA) | Medium | No under-13 accounts in MVP; legal review gates Family mode |
| Gamification games itself (grinding XP without reading) | Medium | XP caps, comprehension-gated bonuses, growth-over-ability rewards |
| Cold start: nothing to read at install | High | Bundled Gutenberg starter shelf + one-tap article import |
| Solo/small-team scope creep | High | The Section-4 cut list is the contract; anything not on it is v2 by default |

**The single biggest product risk,** stated plainly: this app lives or dies on whether the quiz moment feels like a *reward* (a checkpoint you clear) or a *test* (a judgment you fear). Every design decision above — deferrable quizzes, evidence quotes, coaching language, growth-weighted scoring — exists to keep it on the right side of that line. Instrument that feeling from day one: after every 10th quiz, ask one question — "Did that check feel helpful or annoying?" — and let the answer steer the roadmap.
