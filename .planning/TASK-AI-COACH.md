# Task: Build AI Coach Feature for RepTrack

## Context
You are building an AI coaching assistant for RepTrack, a fitness tracking web app. The app is at `/Users/poverty/Coding/fitness-app/reptrack3/`. It's a React 19 CRA app with HashRouter, localStorage for data, optional Supabase sync. Deployed to GitHub Pages.

## CRITICAL: Read These Files First
1. `.planning/PRD-ai-coach-philosophy.md` — Full coaching philosophy (Greg Doucette's "Harder Than Last Time")
2. `.planning/PRD-ai-coach-session.md` — Session-scoped implementation PRD
3. `.planning/PROJECT.md` — Project overview and requirements
4. `.planning/ROADMAP.md` — Phase breakdown

## What to Build

### Phase 1: Foundation
1. **Exercise library** (`src/data/exerciseLibrary.js`) — Complete exercise database organized by muscle group with alternatives, equipment tags, compound/isolation classification. Based on the appendix in the philosophy PRD (Section 16).

2. **12 training plan templates** (`src/data/trainingPlans.js`) — All 12 plans from the book taxonomy (Section 5.4.2): Casual (1-day full body 60/90min hyp/str), Moderate (2-day upper/lower 60/90min hyp/str), Hardcore (3-day split 60/90min hyp/str). Each plan has exercises, sets, target reps, intensity levels per set, warm-up sets, working sets, supersets/circuits where applicable.

3. **Coach data models and context** (`src/context/CoachContext.js`) — React context managing:
   - Coach profile: experience level, training days/week, session duration, goal, current plan template ID, progression type (conservative/moderate), current week number, injuries, equipment, cardio preference, onboarding complete flag
   - Workout state: active/inactive, fatigue score, encouragement level, feedback frequency
   - Coaching metadata: best overload lever per exercise, rest preferences, plateau risk, all-out allowed
   - All persisted to localStorage

4. **Onboarding flow** (`src/pages/CoachOnboarding.js`) — Multi-step assessment:
   - Step 1: Experience level (never/beginner/intermediate/advanced)
   - Step 2: Training days per week (honest minimum)
   - Step 3: Session duration (60 or 90 min)
   - Step 4: Goal (hypertrophy or strength)
   - Step 5: Equipment (full gym/home/bodyweight)
   - Step 6: Any injuries
   - Step 7: Plan recommendation with explanation
   - Step 8: Progression assignment (conservative/moderate)
   - Save to coach profile, mark onboarding complete

### Phase 2: Core Coaching Engine
5. **Progressive overload engine** (`src/lib/coachEngine.js`) — Core logic:
   - Compare current set to best historical performance for that exercise
   - Detect which overload lever improved (weight, reps, intensity, rest, tempo)
   - Generate coaching message (celebration for improvement, normalization for regression, encouragement for maintenance)
   - Track plateau detection (4+ weeks no improvement)
   - Suggest next overload lever to try
   - Use the progression tables from Section 7.3 (conservative/moderate)

6. **Intensity + RIR fields** — Modify `ExerciseLogModal.js` to add:
   - Intensity selector (light/moderate/hard/all-out) with coaching cues
   - RIR input (reps in reserve estimate)
   - Guardrails: block all-out for users in first month, block advanced techniques for beginners
   - Tempo cue display based on current plan (TUT for hypertrophy, explosive for strength)

7. **Rest time advisor** (`src/components/RestAdvisor.js`) — After each set:
   - Display recommended rest based on intensity + goal (using the table from Section 5.4.8)
   - Integrate with existing SetTimer component
   - Not rigid — show as suggestion, not stopwatch

8. **Coach feedback component** (`src/components/CoachFeedback.js`) — Displays after each logged set:
   - Progressive overload comparison to last session
   - Coaching message in the selected personality (soft/balanced/tough/aggressive)
   - Next set guidance (target reps, intensity, weight suggestion)
   - Respects feedback frequency setting (minimal/normal/detailed)

9. **Wire into ActiveWorkout flow** — Integrate coach feedback into the existing `ActiveWorkout.js` + `ExerciseLogModal.js` flow. Coach activates when workout starts, provides per-set feedback, deactivates when workout ends.

### Phase 3: Summaries & Polish
10. **Post-workout summary** (`src/components/WorkoutSummary.js`) — End-of-session recap:
    - Total sets, volume, duration
    - Progressive overload highlights (which exercises improved)
    - Regressions with context (fatigue? bad day?)
    - Cardio minutes logged
    - Next session preview (which plan day is next)

11. **Cardio tracking** — Add cardio log to coach context:
    - Track weekly cardio minutes toward 150-min target
    - 10-min warm-up counts toward target
    - Walking at half-credit unless elderly/obese
    - Weekly compliance nudge

12. **Coach settings page** (`src/pages/CoachSettings.js`) — Accessible from Profile:
    - Encouragement style slider (soft/balanced/tough/aggressive)
    - Feedback frequency (minimal/normal/detailed)
    - Current plan display + switch plan
    - Progression mode toggle
    - View coaching metadata (plateau risks, best overload levers)

13. **Navigation integration** — Add Coach tab to BottomNav, route setup in App.js, onboarding gate (if not onboarded, show onboarding first)

## Style Guide
- Match existing app dark theme (see App.css, Page.css)
- Mobile-first, used during workouts
- Keep messages SHORT — users are mid-set
- No heavy dependencies — vanilla React patterns
- localStorage for all coach data (prefix with `coach_`)

## Testing
- `npm start` must work without errors
- `npm run build` must succeed
- All existing functionality must still work (don't break ExerciseLogModal, ActiveWorkout, etc.)

## When Done
Run `npm run build` to verify it compiles. Then run:
```
openclaw gateway wake --text "Done: AI Coach feature built for RepTrack — onboarding, per-set coaching, progressive overload engine, workout summaries, cardio tracking, coach settings. Ready for review." --mode now
```
