import { supabase, supabaseUrl } from './supabase';

const COACH_FUNCTION_URL = supabaseUrl ? `${supabaseUrl}/functions/v1/coach-generate` : null;

function toIso(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function getAuthenticatedSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) return null;
  return data.session;
}

async function invokeCoachFunction(payload) {
  if (!COACH_FUNCTION_URL) return null;
  const session = await getAuthenticatedSession();
  if (!session) return null;

  const response = await fetch(COACH_FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Coach service failed (${response.status})`);
  return response.json();
}

export async function beginCoachWorkout(activeWorkoutSession) {
  if (!supabase || !activeWorkoutSession?.startedAt) return null;
  const session = await getAuthenticatedSession();
  if (!session) return null;
  const userId = session.user?.id;
  if (!userId) return null;

  const localStartedAt = toIso(activeWorkoutSession.startedAt);
  const { data, error } = await supabase
    .from('coach_workout_sessions')
    .upsert({
      user_id: userId,
      plan_id: activeWorkoutSession.planId || null,
      local_started_at: localStartedAt,
      started_at: localStartedAt,
      status: 'active',
      metadata: {
        planName: activeWorkoutSession.planName || null,
        deviceId: activeWorkoutSession.deviceId || null,
      },
    }, { onConflict: 'user_id,local_started_at' })
    .select('id')
    .single();

  if (error) throw error;
  return data?.id || null;
}

export async function endCoachWorkout(activeWorkoutSession, summary = {}) {
  if (!supabase || !activeWorkoutSession?.startedAt) return null;
  const session = await getAuthenticatedSession();
  if (!session?.user?.id) return null;

  const localStartedAt = toIso(activeWorkoutSession.startedAt);
  const { data, error } = await supabase
    .from('coach_workout_sessions')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      summary,
    })
    .eq('user_id', session.user.id)
    .eq('local_started_at', localStartedAt)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
}

export async function requestAiCoachMessage({
  exerciseLogId,
  exerciseId,
  setIndex,
  clientSetId,
  setFingerprint,
  localStartedAt,
}) {
  if (!exerciseLogId || setIndex === null || setIndex === undefined) return null;
  return invokeCoachFunction({
    exerciseLogId,
    exerciseId,
    setIndex,
    clientSetId,
    setFingerprint,
    localStartedAt: toIso(localStartedAt),
  });
}
