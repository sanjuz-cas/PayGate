import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

export function usePollingResource<T>(
  load: () => Promise<T>,
  intervalMs: number,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const failureCount = useRef(0);
  const timer = useRef<number | null>(null);

  const refresh = useEffectEvent(async () => {
    // Do not let a slow or failed request overlap with the next poll tick.
    // Overlapping fetches can exhaust the browser's connection resources.
    if (refreshInFlight.current) {
      return;
    }

    refreshInFlight.current = true;
    try {
      const next = await load();
      startTransition(() => {
        setData(next);
        setError(null);
        setLoading(false);
      });
      failureCount.current = 0;
    } catch (err) {
      failureCount.current += 1;
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
    } finally {
      refreshInFlight.current = false;
    }
  });

  useEffect(() => {
    let disposed = false;

    const poll = async () => {
      await refresh();
      if (disposed) return;

      const backoff = Math.min(
        intervalMs * 2 ** Math.min(failureCount.current, 4),
        30_000,
      );
      timer.current = window.setTimeout(poll, backoff);
    };

    void poll();

    return () => {
      disposed = true;
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, [intervalMs, refresh]);

  return {
    data,
    error,
    loading,
    refresh,
    setData,
  };
}
