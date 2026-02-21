import React from 'react';
import './Page.css';

const sessions = [
  { date: 'Feb 20', type: 'Upper Body', duration: '52 min', sets: 18 },
  { date: 'Feb 18', type: 'Legs', duration: '44 min', sets: 16 },
  { date: 'Feb 16', type: 'Push', duration: '48 min', sets: 15 },
  { date: 'Feb 14', type: 'Pull', duration: '41 min', sets: 14 },
  { date: 'Feb 12', type: 'Full Body', duration: '60 min', sets: 20 },
];

export default function History() {
  return (
    <div className="page">
      <h2 className="page-heading">History 📅</h2>
      <p className="page-sub">Past sessions</p>

      <div className="history-list">
        {sessions.map((s, i) => (
          <div className="history-card" key={i}>
            <div className="history-left">
              <div className="history-date">{s.date}</div>
              <div className="history-type">{s.type}</div>
            </div>
            <div className="history-right">
              <div className="history-duration">{s.duration}</div>
              <div className="history-sets">{s.sets} sets</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
