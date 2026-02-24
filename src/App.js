import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TimerProvider } from './context/TimerContext'
import BottomNav from './components/BottomNav'
import AuthScreen from './components/AuthScreen'
import SetupScreen from './components/SetupScreen'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Workout from './pages/Workout'
import Workouts from './pages/Workouts'
import Exercises from './pages/Exercises'
import History from './pages/History'
import Progress from './pages/Progress'
import Profile from './pages/Profile'
import ActiveWorkout from './pages/ActiveWorkout'
import CoachView from './pages/CoachView'
import SyncIndicator from './components/SyncIndicator'
import UpdateBanner from './components/UpdateBanner'
import { useState } from 'react'
import './App.css'

function SyncBar() {
  const { syncing, syncError } = useAuth();
  if (syncing) return <div className="sync-bar">⟳ Syncing data…</div>;
  if (syncError) return <div className="sync-bar sync-bar--error">⚠ Sync error: {syncError}</div>;
  return null;
}

function AppContent() {
  const { user, loading, isConfigured } = useAuth();
  const [skippedSetup, setSkippedSetup] = useState(false);

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">💪</div>
          <p style={{ color: '#9999b3', fontSize: '0.9rem' }}>Loading…</p>
        </div>
      </div>
    );
  }

  // Supabase not configured — show setup screen (once)
  if (!isConfigured && !skippedSetup) {
    return <SetupScreen onSkip={() => setSkippedSetup(true)} />;
  }

  // Configured but not logged in
  if (isConfigured && !user) {
    return <AuthScreen />;
  }

  // Authenticated (or running locally without config)
  return (
    <TimerProvider>
      <div className="app">
        <UpdateBanner />
        <SyncBar />
        <SyncIndicator />
        <main className="app-main">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/home"          element={<Home />} />
            <Route path="/workout"       element={<Workout />} />
            <Route path="/workout/:planId" element={<ActiveWorkout />} />
            <Route path="/workouts"      element={<Workouts />} />
            <Route path="/exercises"     element={<Exercises />} />
            <Route path="/history"       element={<History />} />
            <Route path="/progress"      element={<Progress />} />
            <Route path="/profile"       element={<Profile />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </TimerProvider>
  );
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        {/* Coach view is outside AuthProvider's guard — no login needed */}
        <Routes>
          <Route path="/coach/:token" element={<CoachView />} />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}

export default App
