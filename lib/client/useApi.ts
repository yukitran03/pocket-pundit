"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult, DataSource } from "./api";

export type ApiState<T> =
  | { status: "loading"; data: null; source: null; error: null }
  | { status: "ok"; data: T; source: DataSource; error: null }
  | { status: "error"; data: null; source: null; error: Error };

/** Fetch once on mount (and when `key` changes), abort on unmount, expose reload(). */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<ApiResult<T>>, key: string | null) {
  const [state, setState] = useState<ApiState<T>>({ status: "loading", data: null, source: null, error: null });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (key === null) return;
    const ctrl = new AbortController();
    setState({ status: "loading", data: null, source: null, error: null });
    fetcherRef
      .current(ctrl.signal)
      .then((r) => {
        if (!ctrl.signal.aborted) setState({ status: "ok", data: r.data, source: r.source, error: null });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || (err as Error)?.name === "AbortError") return;
        setState({ status: "error", data: null, source: null, error: err instanceof Error ? err : new Error(String(err)) });
      });
    return () => ctrl.abort();
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  /** Replace data locally after a successful mutation. */
  const mutate = useCallback((fn: (prev: T) => T) => {
    setState((s) => (s.status === "ok" ? { ...s, data: fn(s.data) } : s));
  }, []);

  return { ...state, reload, mutate };
}
