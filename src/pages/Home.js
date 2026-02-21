import React from 'react';
import './Page.css';

export default function Home() {
  return (
    <div className="page">
      <h2 className="page-heading">Good evening 👋</h2>
      <p className="page-sub">Ready to crush it today?</p>

      <div className="card">
        <div className="card-label">Today's goal</div>
        <div className="card-value">Upper Body</div>
      </div>

      <div className="card">
        <div className="card-label">Streak</div>
        <div className="card-value">🔥 5 days</div>
      </div>

      <div className="card">
        <div className="card-label">Last workout</div>
        <div className="card-value">Yesterday — Legs</div>
      </div>
    </div>
  );
}
