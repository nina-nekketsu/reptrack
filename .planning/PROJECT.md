# RepTrack AI Coach — "Harder Than Last Time"

## What This Is

An AI coaching assistant embedded in RepTrack that activates during workout sessions, provides real-time progressive overload guidance, and coaches users based on Greg Doucette's "Harder Than Last Time" philosophy. It's session-scoped (cost-controlled), compares every set to historical performance, and delivers short actionable feedback.

## Core Value

Every logged set gets compared to the user's history and the coach tells them how to progress — more reps, more weight, better technique, or just "good job, stay consistent." The coach is the antidote to generic fitness advice.

## Requirements

### Active

- [ ] **REQ-01**: Coach onboarding flow — assess user (experience, days/week, session duration, goal) and recommend one of 12 training templates
- [ ] **REQ-02**: Session-scoped activation — coach activates on "Start Workout", deactivates on "End Workout"
- [ ] **REQ-03**: Per-set coaching — after each logged set, compare to history, provide progressive overload feedback
- [ ] **REQ-04**: Intensity system — light/moderate/hard/all-out with RIR tracking and guardrails (no all-out for beginners)
- [ ] **REQ-05**: Rest time guidance — context-aware rest suggestions based on intensity and goal (hypertrophy vs strength)
- [ ] **REQ-06**: Progressive overload engine — track multiple overload levers (weight, reps, tempo, rest, ROM, RIR)
- [ ] **REQ-07**: Post-workout summary — recap with progressive overload highlights, regressions, next session preview
- [ ] **REQ-08**: Cardio compliance tracking — track weekly cardio minutes toward 150-min target
- [ ] **REQ-09**: Coach personality — direct, honest, motivating, anti-BS tone with configurable encouragement slider
- [ ] **REQ-10**: Exercise library — comprehensive exercise database organized by muscle group with alternatives
- [ ] **REQ-11**: Plan adaptation — switch between 12 templates based on schedule/goal changes
- [ ] **REQ-12**: Weekly check-in and monthly progress review
- [ ] **REQ-13**: Deload detection — suggest only when appropriate (not scheduled)
- [ ] **REQ-14**: Coaching metadata — self-improving engine that learns user patterns (rest preferences, best overload levers, plateau detection)

### Out of Scope

- Video form analysis — future consideration
- Clinical nutrition plans — agent is not a dietitian
- PED/steroid guidance
- Real-time background monitoring when not training
- Service workers / offline support

## Context

- **Stack:** React 19, CRA, HashRouter, localStorage + optional Supabase sync
- **Existing:** ~4K lines, 12 pages/components, ExerciseLogModal handles set logging, TimerContext for workout timer
- **Deployment:** GitHub Pages via gh-pages
- **CoachView already exists** — read-only coach dashboard for external viewing (different from this AI coach feature)
- **Both PRDs provided:** Full philosophy PRD (16 sections) + Session-scoped implementation PRD (20 sections)

## Constraints

- **Cost:** Coach uses local logic + lightweight AI calls only during active sessions. No background processing.
- **Storage:** localStorage-first (like existing app), Supabase sync optional
- **No new heavy deps:** Keep bundle size reasonable. Prefer vanilla React patterns.
- **Existing UX:** Must integrate with existing ExerciseLogModal, TimerContext, ActiveWorkout flow
- **Mobile-first:** App is used on phones during workouts

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-first coaching logic | Cost control, works offline, instant feedback | — Pending |
| Session-scoped only | PRD requirement, prevents cost blowout | — Pending |
| 12 template system from book | Core philosophy, non-negotiable | — Pending |
| Encouragement style slider | Personalization per PRD2 §14.1 | — Pending |
