# PRD — Persistent Global Workout Timer (Superset-Safe)

## 1. Overview
The application currently contains a timer inside the logging screen used for workout tracking. However, the timer resets whenever the user navigates away from the screen, breaking workout continuity and superset flows. This feature introduces a persistent global workout timer that continues running regardless of navigation, backgrounding, refresh, browser close, or device switching.

## 2. Goals

### Primary goals
- Timer persists across screens
- Timer persists across refresh
- Timer persists across browser close
- Timer syncs across devices
- Timer supports superset workflow without resets
- Timer preserves elapsed time accuracy

### Non-goals
- Multiple simultaneous timers
- Interval / EMOM / AMRAP modes
- Analytics usage
- Voice control
- Agent API exposure

## 3. Core behavior

### Global timer model
- Timer is global for the entire workout session
- Timer runs in background independent of UI screen
- Timer is single instance only
- Timer counts upward (exercise timer)
- Separate rest timer exists

## 4. Persistence architecture (solution to reset bug)

### Recommended architecture: Hybrid persistence

**Client layer:**
- Global state store (Zustand / Redux / context)
- Local storage backup
- Timestamp-based reconstruction

**Server layer:**
- Server DB stores:
  - workout session id
  - timer start timestamp
  - paused timestamp
  - running state
- Reconstruction logic

**Timer formula:**
```
elapsed = now - start_timestamp - paused_duration
```

This guarantees: refresh safe, navigation safe, background safe, browser close safe, device sync safe.

## 5. Navigation behavior
Timer continues when:
- navigating to other screens
- app backgrounded
- phone locked
- browser closed
- returning later
- opening another device

Timer reconstructs from timestamp.

## 6. Superset logic

### Workflow
Superset model: A → rest → B → rest

### Rules
- Single shared global exercise timer continues
- Starting set B does not reset timer
- Superset order changes do not affect timer
- Rest timer remains separate from exercise timer

## 7. UX interaction
Agent should keep UI visually similar to existing timer.

### Controls
- start
- pause
- reset
- auto stop after 30 minutes safeguard

### Customization
- rest time customizable per exercise
- global default rest time

## 8. Automation rules
- Timer does not auto-start after logging set
- Timer does not auto-start next exercise
- Workout finish stops all timers

## 9. Edge cases

| Case | Behavior |
|------|----------|
| Two timers started | Ignore second instance, continue first |
| User leaves workout mid timer | Timer continues |
| Rest time edited while running | Only affects rest timer |
| Superset order change | Timer unaffected |
| Workout finished | Stop timers |
| Timer exceeds 30 min | Auto stop |

## 10. Technical requirements
- Accuracy: Second-level precision sufficient
- Drift strategy: Timestamp reconstruction eliminates drift

## 11. Acceptance criteria
- Timer never resets on navigation
- Timer persists after refresh
- Timer persists after browser close
- Timer syncs across devices
- Superset transitions have no timer interruption
- Timer accuracy preserved
- Single timer instance enforced

## 12. Implementation notes for GSD agent

### Critical rule
Do NOT implement timer with setInterval as source of truth.

Instead implement:
- server authoritative timestamp
- client reconstruction
- heartbeat sync
- optional background recovery logic
- stale session recovery

## 13. Suggested system architecture
```
Workout Session
├─ session_id
├─ timer_start_timestamp
├─ paused_duration
├─ running_state
└─ last_sync_timestamp
```

Client computes elapsed locally.
