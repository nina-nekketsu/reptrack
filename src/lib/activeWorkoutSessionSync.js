import {
  normalizeActiveWorkoutSession,
  readStoredActiveWorkoutSession,
  writeMergedActiveWorkoutSession,
} from './activeWorkoutSession';

export async function pullActiveWorkoutSession(client, userId, storage) {
  if (!client || !userId) return null;

  const { data, error } = await client
    .from('active_sessions')
    .select('session')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return writeMergedActiveWorkoutSession(data?.session || null, storage);
}

export async function pushActiveWorkoutSession(client, userId, storage) {
  if (!client || !userId) return null;

  const localSession = readStoredActiveWorkoutSession(storage);
  if (!localSession) return null;

  const { data, error } = await client.rpc('merge_active_session', {
    p_user_id: userId,
    p_session: localSession,
  });

  if (error) throw error;
  const remoteWinner = normalizeActiveWorkoutSession(data);
  return writeMergedActiveWorkoutSession(remoteWinner, storage);
}
