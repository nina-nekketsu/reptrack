# 🏋️ Workout Coaching Assistant
## Complete PRD, Harder Than Last Time Edition (Greg Doucette aligned)

This PRD defines an AI coaching agent that runs only during workout sessions, coaches primarily on reps and progressive overload, integrates with an existing workout tracking web app, and stays cost-efficient by design.

This version expands and refines the PRD using tactics, tips, and training rules from Greg Doucette’s *Harder Than Last Time: The Complete Muscle & Strength Training Manual*. :contentReference[oaicite:0]{index=0}

---

# 1. Product Summary

## 1.1 Purpose
Create a session-scoped AI coaching assistant that:
- Activates only during a workout session
- Uses your logged set data to coach progressive overload in real time
- Keeps guidance short, actionable, and aligned with “Harder Than Last Time”
- Produces an end-of-session recap with next-step guidance

## 1.2 Core Principle
The agent’s output is built around: **Always attempt to do better than last time**, but pace progress, use fatigue as a signal, and prioritize safe technique. 

---

# 2. Goals and Non Goals

## 2.1 Goals
1. **Session-only activation** to control cost
2. **Progressive overload guidance** using multiple overload levers, not just adding weight 
3. **Rep-range based coaching** rather than single fixed rep prescriptions :contentReference[oaicite:3]{index=3}
4. **Intensity-aware coaching** (light, moderate, hard, all out) with guardrails 
5. **Rest-time guidance** based on intensity and goal (hypertrophy vs strength) :contentReference[oaicite:5]{index=5}
6. **Tempo and control coaching** for hypertrophy, controlled explosiveness for strength 
7. **Injury avoidance logic** and exercise substitutions :contentReference[oaicite:7]{index=7}
8. **Deload logic** that is not forced on a schedule, but suggested when appropriate :contentReference[oaicite:8]{index=8}
9. **Proactive coaching improvement** that evolves the agent’s behavior over time without increasing cost

## 2.2 Non Goals
- Video form analysis
- Medical advice or diagnosis
- Autonomous background monitoring when not training
- Auto-posting or social automation
- Complex macro nutrition planning (only light, optional reminders)

---

# 3. Personas and Use Cases

## 3.1 Primary user
- You, using your workout web app and Telegram
- You value progressive overload, reps guidance, and motivation
- You want strict cost control and an agent that only runs during training

## 3.2 Key use cases
1. Start workout in web app, agent becomes active
2. Log a set, agent responds with next-set guidance
3. Miss rep range target, agent suggests adjustments
4. Finish workout, agent summarizes and suggests next steps
5. Over time, agent improves coaching based on your data patterns

---

# 4. Lifecycle and Session Gating (Cost Control)

## 4.1 Session activation
Trigger: **Start Workout** button in the web app

System requirements:
- App sends a `workout_session_start` event to the agent
- Agent writes `workout_active=true` into state

## 4.2 Session deactivation
Trigger: **End Workout** signal in the app

System requirements:
- App sends `workout_session_end`
- Agent immediately stops coaching
- Agent generates recap
- Agent compacts state and returns to inactive mode

## 4.3 Inactive behavior
If inactive:
- Agent does not coach
- Agent responds only with a minimal message or ignores
- Agent does not use web tools
- Agent does not “think” using large context

---

# 5. Integration and Data Flow

## 5.1 Source of truth
The workout web app is the system of record for:
- Exercise list
- Set logs (weight, reps)
- Optional fields: RPE, pain flag, notes

## 5.2 Agent reads from app
Integration method is chosen for efficiency by your app builder:
- API pull, webhook push, or direct DB read
- The PRD is interface-agnostic, only defines inputs and outputs

## 5.3 Telegram output
All coaching messages go to Telegram during session.

Rules:
- No messages outside workout session
- No unsolicited spam
- Short messages with a stable structure

---

# 6. Coaching Framework (Harder Than Last Time aligned)

## 6.1 Rep-range based coaching
The agent coaches to rep ranges, because exact reps required for intensity cannot be perfectly predicted, and rep ranges let the user hit the intended effort. :contentReference[oaicite:9]{index=9}

Minimum requirement:
- Each working set has a target rep range and intended intensity

Example:
- Hypertrophy working sets commonly land around 12 to 15 reps
- Strength sets commonly land around 8 to 10, sometimes 5 to 8 for heavier sets :contentReference[oaicite:10]{index=10}

## 6.2 Intensity model (light, moderate, hard, all out)
Agent must label each set intensity and coach accordingly.

### Light set
- Warm-up, technique, injury prevention
- Should feel very easy

### Moderate set
- Working toward real effort, but not a max effort
- If target rep range is 15 to 20, stop with 3 to 5 good reps in reserve 

### Hard set
- Very difficult, maybe 1 to 2 reps in reserve :contentReference[oaicite:12]{index=12}

### All out set
- True failure on full range of motion reps
- Highly advanced, do not prescribe all out work too early
- All out should not be recommended until at least a month into consistent training work with the plan 

## 6.3 Rest time rules (by intensity and goal)
The agent must recommend rest based on training focus:

Hypertrophy:
- Light: up to 1 minute
- Moderate: 1 to 2 minutes
- Hard or all out: 2 to 4 minutes :contentReference[oaicite:14]{index=14}

Strength:
- Light: up to 2 minutes
- Moderate: 2 to 3 minutes
- Hard or all out: 3 to 5 minutes :contentReference[oaicite:15]{index=15}

Important behavior:
- Rest times are guidelines, not exact stopwatch rules
- Rest longer after high intensity sets
- Rest enough to be ready for the next set :contentReference[oaicite:16]{index=16}

## 6.4 Tempo and control rules
For hypertrophy:
- Use control and maximize time under tension
- Eccentric about half the speed of concentric
- Baseline tempo: about 2 seconds down, 1 second up
- Optional pause in peak contracted position :contentReference[oaicite:17]{index=17}

For strength:
- Controlled explosiveness
- Lower under control and lift explosively without getting sloppy :contentReference[oaicite:18]{index=18}

Agent behavior:
- If reps are logged too fast, agent reminds to slow eccentrics for hypertrophy days
- If strength day, agent emphasizes speed with control rather than slow tempo

## 6.5 Choosing weights and working up to sets
The agent must coach conservative weight selection:
- Start conservatively, even consider starting 30 percent lighter than you think
- Safety and recovery matter, too heavy is dangerous and counterproductive 
- If the plan suggests heavier each set but the user is fatigued, do not force increases
- Repeat weight or lower weight if needed to maintain quality reps and full range of motion 

Warm-up sets:
- Some lifters need additional ramp sets before the first true working set
- Agent may suggest adding extra light sets based on user history and performance 

---

# 7. Progressive Overload Engine

## 7.1 Definition
Progressive overload is not only adding weight.
It includes:
- Repetitions
- Technique improvement
- Weight or resistance
- Total volume
- Rest time manipulation
- Reps in reserve manipulation 

## 7.2 Pacing progress
Agent must prevent reckless weekly escalation:
- Training is a marathon, not a sprint
- Do not go all out immediately in week one
- Use soreness and fatigue as indicators of going too fast or too slow 

## 7.3 Built-in progression tables
The agent supports two progression styles for hard and all out sets:

### Conservative progression
- Week 1: 6 to 10 reps in the tank
- Week 2: 5 reps in the tank
- Week 3: 3 to 4 reps in the tank
- Week 4: 2 to 3 reps in the tank
- Month 1+: 1 to 2 reps in the tank
- Month 2+: true all out 

### Moderate progression
- Week 1: 3 to 4 reps in the tank
- Week 2: 2 to 3 reps in the tank
- Week 3: 1 to 2 reps in the tank
- Week 4+: true all out 

Agent requirement:
- The app must store user selected progression mode: `conservative` or `moderate`

## 7.4 Overload when weight cannot increase
The agent must recommend overload levers if adding weight is not possible or not wise:

- Increase reps per set
- Reduce rest time between sets
- Increase range of motion
- Slow the eccentric, increase time under tension
- Increase pause in the contracted position or bottom position
- Add or increase band tension
- Combine multiple modifications (band plus slow eccentric plus pause plus ROM plus short rest) 

Agent behavior:
- If weight is unchanged for multiple sessions, the agent proposes one alternative overload lever rather than insisting on weight jumps

---

# 8. Missed Target Handling (Behavior Policy)

## 8.1 If user misses rep range but technique is good
Agent response:
- Maintain weight
- Aim to add reps next time
- Encourage consistency and effort

This aligns with the principle that you will not progress every workout forever and that is acceptable. :contentReference[oaicite:27]{index=27}

## 8.2 If user misses rep range and fatigue is high
Agent response:
- Suggest longer rest
- Suggest holding weight steady
- Suggest reducing load slightly if needed for full ROM reps and safety 

## 8.3 If user misses repeatedly for months
Agent response:
- Suggest an exercise change only for valid reasons:
  - boredom
  - injury
  - lack of equipment
  - zero progress for multiple months 

---

# 9. Exercise Selection and Change Rules

## 9.1 Default rule
Do not change exercises too often.
Consistency is required for adaptation. :contentReference[oaicite:30]{index=30}

## 9.2 Reasons to change exercises
Valid reasons:
- Boredom
- Injury pain
- Equipment limitation
- No progress for multiple months 

## 9.3 Injury avoidance
Agent must never recommend an exercise that causes injury-type pain.
If pain is reported:
- Stop or modify
- Recommend alternative patterns targeting the same muscle group :contentReference[oaicite:32]{index=32}

---

# 10. Deload and Recovery Logic

## 10.1 Deload philosophy
Deloads are not always scheduled.
Life often creates deloads naturally. :contentReference[oaicite:33]{index=33}

## 10.2 When to deload
If user is:
- Not progressing
- Feeling beat up
- Mentally fatigued
- Accumulating aches and pains

Agent suggests:
- A few days off, focus on cardio
- Or a period of training easier than last time, lower intensity, new exercises for fun :contentReference[oaicite:34]{index=34}

## 10.3 When not to deload
If user is:
- progressing
- injury free
- still able to push mentally and physically

Agent should not push a deload suggestion. :contentReference[oaicite:35]{index=35}

---

# 11. Warm-up and Cardio Hooks (Optional but aligned)

## 11.1 General warm-up
Agent may suggest:
- 10 minutes moderate steady-state cardio before lifting to elevate body temperature and prevent injury :contentReference[oaicite:36]{index=36}

## 11.2 Progressive overload applies to cardio too
If cardio is tracked in app:
- Encourage slightly faster pace over time while staying sustainable :contentReference[oaicite:37]{index=37}

This is optional and can be a later feature flag:
- `enable_cardio_coaching=false` by default

---

# 12. Advanced Techniques Guardrails

## 12.1 Advanced techniques are not for beginners
Examples:
- drop sets
- forced reps
- partial reps beyond failure

Agent policy:
- Do not recommend beyond-failure methods to beginners
- Only unlock advanced techniques if:
  - user explicitly enables advanced mode, and
  - user has sufficient training age or has followed the plan for a minimum period 

---

# 13. Motivation and Mindset Features

## 13.1 Encourage “show up” and consistency
Agent must reinforce:
- consistency matters long term
- doing your best each session beats on and off extremes 

## 13.2 Realistic progress pacing
Agent must remind:
- progress should be evaluated monthly, not necessarily every session
- advanced lifters zoom out to longer horizons 

---

# 14. Personalization Controls (App Features)

## 14.1 Encouragement style slider
Values:
- soft
- balanced
- tough
- aggressive

Agent output changes:
- Soft: calm, supportive
- Aggressive: direct, pushy, “coach voice” but still safe

## 14.2 Feedback frequency slider
Values:
- minimal
- normal
- detailed

Rules:
- Minimal: 1 short line after set
- Normal: 2 to 3 lines including next-set suggestion
- Detailed: adds one rationale sentence, still under word cap

---

# 15. Proactive Coaching Improvement Engine (Detailed)

This section defines how the agent improves proactively over time, without increasing cost.

## 15.1 Improvement goal
Increase the relevance and effectiveness of coaching by learning patterns from:
- logged sets
- success rates in rep ranges
- fatigue and soreness signals
- injury notes
- adherence patterns (how often you complete planned sets)

## 15.2 Improvement constraints (cost and safety)
The improvement engine must:
- run only at session end
- use stored logs and summaries rather than chat history
- never run web searches unless explicitly requested
- never schedule background tasks

## 15.3 Coaching evolution outputs
After each session, the agent writes to `coaching_metadata.json`:
- progression mode confidence (conservative vs moderate)
- estimated recovery tolerance
- typical rest time needed per intensity
- best performing rep range per exercise category
- plateau risk score per lift
- injury risk flags for movements that cause pain

## 15.4 Progressive overload tuning over time
The agent must learn:
- which overload lever works best for you

Examples:
- If weight increases stall but reps climb, recommend rep progression more often
- If reps stall but rest times were short, recommend slightly longer rest and retry
- If fatigue spikes when pushing intensity too fast, agent shifts you toward conservative progression table 

## 15.5 Fatigue, soreness, and pacing model
Because the book emphasizes using soreness and fatigue as indicators of speed of progression, the agent must:
- track a simple fatigue score
- adjust recommendations if fatigue accumulates too quickly :contentReference[oaicite:42]{index=42}

Fatigue score inputs (examples):
- consecutive sessions with missed rep ranges
- user logs “beat up”
- reduced performance on multiple compounds
- pain flags

Fatigue score outputs:
- hold weight steady
- use conservative progression
- suggest deload or easier-than-last-time period if appropriate :contentReference[oaicite:43]{index=43}

## 15.6 Plateau detection aligned with exercise change rules
Plateau triggers:
- no improvement for multiple months on same exercise
- user reports boredom
- pain flags or poor tolerance

Agent must not suggest random exercise changes early.
It should follow the “keep exercises for a long time” rule, and only change when justified. :contentReference[oaicite:44]{index=44}

## 15.7 “Do the exercises you enjoy” personalization
Agent stores:
- enjoyment rating per exercise (optional app prompt)
- compliance rate per exercise

Agent uses this to:
- recommend exercise selection you will actually do, improving consistency 

## 15.8 Rest time personalization
Agent learns:
- how long you actually need after hard sets
- whether you recover well with shorter rests

It then adjusts guidance while staying inside the book’s ranges. :contentReference[oaicite:46]{index=46}

## 15.9 Tempo personalization
If hypertrophy day and reps are completed too fast:
- agent nudges tempo and control
If strength day:
- agent nudges controlled explosiveness

Over time:
- agent learns which cue style results in better performance and fewer pain flags 

## 15.10 “All out” unlocking policy
All out work is advanced.
Agent must never rush it.

Unlocking conditions:
- user has completed at least 1 month of consistent training on the plan
- user is not accumulating fatigue or injury flags
- user explicitly enables “all out allowed” toggle

This is aligned with the book’s warning not to go all out too early. 

---

# 16. Message Templates (Telegram)

All messages must be short. Agent selects template by frequency mode.

## 16.1 Minimal mode
- “Set logged. Next set: aim 10 to 12 reps, same weight, rest 2 to 3 min.”

## 16.2 Normal mode
- “Good set. Next set: keep weight, aim top of range, rest 2 to 4 min.”
- “If you miss range, keep form, hold weight, add reps next set.”

## 16.3 Detailed mode
- “Good set. Next: hold weight, aim 10 to 12 reps, rest 2 to 4 min. We are progressing by reps and quality today.”

All templates must respect:
- rest-time rules
- rep range logic
- intensity definitions

---

# 17. State and Storage

## 17.1 workout_state.json
Fields:
- workout_active: boolean
- progression_mode: conservative | moderate
- encouragement_level: soft | balanced | tough | aggressive
- feedback_frequency: minimal | normal | detailed
- injuries: list
- fatigue_score: integer 0 to 100
- enable_cardio_coaching: boolean

## 17.2 coaching_metadata.json
Fields:
- best_overload_lever_per_exercise: map
- rest_time_preference_by_intensity: map
- plateau_risk_by_lift: map
- progression_mode_confidence: number
- all_out_allowed: boolean
- exercise_enjoyment: map (optional)
- injury_flags_by_movement: map

---

# 18. Safety and Boundaries

- No medical advice
- If pain is injury-type pain, recommend stopping and switching exercises
- Always prioritize full range of motion reps with quality technique 

---

# 19. Acceptance Criteria

The feature is successful when:
1. Agent only runs during session
2. Messages only occur after a set is logged
3. Coaching uses rep ranges and intensity, not fixed reps
4. Rest guidance matches book rules
5. Progressive overload uses multiple levers, not only weight
6. Missed targets trigger safe, fatigue-aware guidance
7. Exercise change suggestions follow valid reasons only
8. All out is gated and not rushed
9. Proactive improvement updates metadata after each session, no background runs

---

# 20. OpenClaw Agent Policy Snippet

```json
{
  "modes": ["INACTIVE", "ACTIVE"],
  "default_mode": "INACTIVE",
  "inactive_behavior": "No coaching. Reply: 'Workout mode is off. Start a session in the app.'",
  "active_behavior": [
    "Coach only after set logs",
    "Use rep ranges and intensity",
    "Use rest guidelines by training focus",
    "Use overload levers beyond weight when needed",
    "Use fatigue and soreness signals to pace progression",
    "Stop immediately on session end"
  ],
  "web_usage": "Never use web tools unless explicitly requested by the user"
}