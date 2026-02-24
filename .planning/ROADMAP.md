# Roadmap — AI Coach Feature

## Phase 1: Foundation — Data Models + Exercise Library + Coach Context
**Goal:** Build the data layer, exercise library, coach state management, and onboarding.
**Requirements:** REQ-01, REQ-10, REQ-14 (partial)

### Tasks:
1. **Exercise library data** — Complete exercise database (JSON) with all muscle groups, alternatives, equipment tags
2. **Coach data models** — User coaching profile, workout state, coaching metadata, progressive overload history (all localStorage)
3. **Coach context provider** — React context for coach state (active/inactive, current plan, progression mode, settings)
4. **Onboarding flow** — Multi-step assessment screen (experience, days/week, duration, goal) → plan recommendation → save to coach profile
5. **12 training plan templates** — All 12 plans from the book as structured data (exercises, sets, reps, intensity targets per set)

## Phase 2: Core Coaching Engine
**Goal:** Real-time per-set coaching with progressive overload detection and intensity management.
**Requirements:** REQ-02, REQ-03, REQ-04, REQ-05, REQ-06

### Tasks:
1. **Session activation/deactivation** — Hook into existing ActiveWorkout start/end flow, toggle coach active state
2. **Progressive overload engine** — Compare current set to history, detect improvement/maintenance/regression across all overload levers
3. **Intensity system + RIR tracking** — Add intensity/RIR fields to set logging, enforce guardrails (no all-out for new users)
4. **Rest time advisor** — Suggest rest based on intensity level and training focus (hypertrophy/strength)
5. **Per-set coach feedback component** — UI component that displays coach message after each logged set
6. **Integration with ExerciseLogModal** — Wire coach feedback into existing set logging flow

## Phase 3: Summaries, Cardio, and Adaptation
**Goal:** Post-workout summaries, cardio tracking, plan switching, weekly/monthly reviews.
**Requirements:** REQ-07, REQ-08, REQ-09, REQ-11, REQ-12, REQ-13

### Tasks:
1. **Post-workout summary** — Generate and display session recap (overload wins, regressions, volume, next session preview)
2. **Cardio tracking** — Cardio log model, weekly 150-min target tracker, warm-up integration
3. **Plan adaptation** — UI to switch between 12 templates, handle mid-plan switches gracefully
4. **Coach personality + settings** — Encouragement slider (soft/balanced/tough/aggressive), feedback frequency (minimal/normal/detailed)
5. **Weekly check-in + monthly review** — Periodic summaries, strength trends, body comp tracking hooks
6. **Deload detection** — Logic to suggest deload only when warranted (fatigue accumulation, stalls, pain flags)
7. **Coaching metadata engine** — Post-session metadata writer (best overload levers, plateau risk, rest preferences)

## Status

- [ ] Phase 1: Foundation — NOT STARTED
- [ ] Phase 2: Core Coaching — NOT STARTED
- [ ] Phase 3: Summaries & Adaptation — NOT STARTED
