import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

export function usePollingResource<T>(
  load: () => Promise<T>,
  intervalMs: number,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useEffectEvent(async () => {
    try {
      const next = await load();
      startTransition(() => {
        setData(next);
        setError(null);
        setLoading(false);
      });
    } catch (err) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
    }
  });

  useEffect(() => {
    void refresh();
    const handle = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => window.clearInterval(handle);
  }, [intervalMs, refresh]);

  return {
    data,
    error,
    loading,
    refresh,
    setData,
  };
}
