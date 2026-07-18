import { useEffect, useState } from 'react';
import { requestAiCoachMessage } from '../lib/coachCloud';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

export function useAiCoachMessage({
  enabled = true,
  exerciseLogId,
  exerciseId,
  setIndex,
  clientSetId,
  setFingerprint,
  localStartedAt,
}) {
  const [aiMessage, setAiMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    async function run(attempt = 0) {
      if (!enabled || !exerciseLogId || setIndex === null || setIndex === undefined) {
        setAiMessage(null);
        setLoading(false);
        setSource(null);
        return;
      }

      setLoading(true);
      let result = null;
      try {
        result = await requestAiCoachMessage({
          exerciseLogId,
          exerciseId,
          setIndex,
          clientSetId,
          setFingerprint,
          localStartedAt,
        });
      } catch {
        result = null;
      }

      if (cancelled) return;
      if (!result?.message && attempt < MAX_RETRY_ATTEMPTS) {
        retryTimer = setTimeout(() => run(attempt + 1), RETRY_DELAY_MS);
        return;
      }
      setAiMessage(result?.message || null);
      setSource(result?.source || null);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled, exerciseLogId, exerciseId, setIndex, clientSetId, setFingerprint, localStartedAt]);

  return { aiMessage, loading, source };
}
