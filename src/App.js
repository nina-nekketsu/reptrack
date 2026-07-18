import { HashRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TimerProvider } from './context/TimerContext'
import { CoachProvider } from './context/CoachContext'
import BottomNav from './components/BottomNav'
import AuthScreen from './components/AuthScreen'
import SetupScreen from './components/SetupScreen'
import Dashboard from './pages/Dashboard'
import Workouts from './pages/Workouts'
import Exercises from './pages/Exercises'
import History from './pages/History'
import Progress from './pages/Progress'
import Profile from './pages/Profile'
import ActiveWorkout from './pages/ActiveWorkout'
import CoachView from './pages/CoachView'
import Coach from './pages/Coach'
import CoachSettings from './pages/CoachSettings'
import SyncIndicator from './components/SyncIndicator'
import UpdateBanner from './components/UpdateBanner'
import { useState } from 'react'
import './App.css'

function AppContent() {
  const { user, loading, isConfigured } = useAuth();
  const [skippedSetup, setSkippedSetup] = useState(false);

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card auth-card--loading" role="status" aria-live="polite">
          <div className="auth-logo auth-logo--mark" aria-hidden="true">R</div>
          <p className="auth-loading-copy">Loading RepTrack...</p>
          <p className="auth-loading-help">
            Stuck here? Try holding the reload button and choosing Reload Without Content Blockers.
          </p>
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
      <CoachProvider>
        <div className="app">
          <UpdateBanner />
          <SyncIndicator />
          <main className="app-main">
            <Routes>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/today"         element={<Dashboard />} />
              <Route path="/home"          element={<Navigate to="/today" replace />} />
              <Route path="/workout"       element={<Navigate to="/workouts" replace />} />
              <Route path="/workout/:planId" element={<ActiveWorkout />} />
              <Route path="/workouts"      element={<Workouts />} />
              <Route path="/exercises"     element={<Exercises />} />
              <Route path="/history"       element={<History />} />
              <Route path="/progress"      element={<Progress />} />
              <Route path="/profile"       element={<Profile />} />
              <Route path="/coach"         element={<Coach />} />
              <Route path="/coach/settings" element={<CoachSettings />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </CoachProvider>
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
