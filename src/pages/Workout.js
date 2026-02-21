import React from 'react';
import './Page.css';

const exercises = [
  { name: 'Bench Press', sets: 4, reps: '8–10' },
  { name: 'Pull-ups', sets: 3, reps: '6–8' },
  { name: 'Shoulder Press', sets: 3, reps: '10–12' },
  { name: 'Tricep Dips', sets: 3, reps: '12' },
];

export default function Workout() {
  return (
    <div className="page">
      <h2 className="page-heading">Today's Workout 💪</h2>
      <p className="page-sub">Upper Body — Est. 45 min</p>

      <div className="exercise-list">
        {exercises.map((ex, i) => (
          <div className="exercise-card" key={i}>
            <div className="exercise-name">{ex.name}</div>
            <div className="exercise-meta">{ex.sets} sets × {ex.reps} reps</div>
          </div>
        ))}
      </div>

      <button className="btn-primary">Start Workout</button>
    </div>
  );
}
