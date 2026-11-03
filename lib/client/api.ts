// All client-side data access goes through here.
// - NEXT_PUBLIC_USE_MOCK=1 → realistic fixtures (source "mock"), labelled "Demo data" in the UI.
// - In development, if the API is unreachable or returns 404/5xx → fixtures (source "fallback"), labelled.
// - In production → live API only; failures surface as errors with retry, never as fixtures.

import type {
  MeResponse,
  MemoryRow,
  NewMemoryBody,
  ProofResponse,
  RecallResponse,
  SettingsBody,
  StatsResponse,
} from "@/lib/contract";

export type DataSource = "live" | "mock" | "fallback";
export interface ApiResult<T> {
  data: T;
  source: DataSource;
}

export class ApiError extends Error {
  readonly status: number;
  /** True when the API itself answered with a JSON error (a real answer), false for proxy/HTML errors. */
  readonly fromApi: boolean;
  constructor(status: number, message: string, fromApi = true) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fromApi = fromApi;
  }
  /** The token is missing, expired or not recognised. */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";
const IS_DEV = process.env.NODE_ENV === "development";

const fixtures = () => import("@/lib/fixtures");
const mockDelay = (ms = 420) => new Promise((r) => setTimeout(r, ms));

/**
 * Development only: fall back to fixtures when the API is unreachable, the route doesn't exist yet
 * (non-JSON 404) or the server errors. A JSON 4xx is a real answer (bad token, unknown user, validation),
 * so it is never masked.
 */
function devFallbackAllowed(err: unknown): boolean {
  if (!IS_DEV) return false;
  if (err instanceof ApiError) return err.status >= 500 || !err.fromApi;
  return true; // network error / bad JSON
}

async function request<T>(path: string, init: RequestInit | undefined, fixture: () => Promise<T>, signal?: AbortSignal): Promise<ApiResult<T>> {
  if (USE_MOCK) {
    await mockDelay();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return { data: await fixture(), source: "mock" };
  }
  try {
    const res = await fetch(path, {
      ...init,
      signal,
      cache: "no-store",
      headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
    });
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`.trim();
      let fromApi = false;
      if ((res.headers.get("content-type") ?? "").includes("application/json")) {
        try {
          const body = (await res.json()) as { error?: string; message?: string };
          message = body.error ?? body.message ?? message;
          fromApi = true;
        } catch {
          /* malformed JSON error body */
        }
      }
      throw new ApiError(res.status, message, fromApi);
    }
    return { data: (await res.json()) as T, source: "live" };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    if (devFallbackAllowed(err)) {
      console.warn(`[match-finder] ${path} unavailable in development, showing labelled sample data.`, err);
      return { data: await fixture(), source: "fallback" };
    }
    throw err;
  }
}

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) s.set(k, v);
  return s.toString();
};

function checkMockToken(token: string) {
  if (USE_MOCK && (token === "invalid" || token === "expired")) throw new ApiError(401, "This link has expired.");
}

export function getStats(signal?: AbortSignal) {
  return request<StatsResponse>("/api/stats", undefined, async () => (await fixtures()).FIXTURE_STATS, signal);
}

export function getProof(signal?: AbortSignal) {
  return request<ProofResponse>("/api/proof", undefined, async () => (await fixtures()).FIXTURE_PROOF, signal);
}

export async function getMe(token: string, signal?: AbortSignal) {
  checkMockToken(token);
  return request<MeResponse>(`/api/me?${q({ t: token })}`, undefined, async () => (await fixtures()).FIXTURE_ME, signal);
}

export function recall(token: string, query: string, signal?: AbortSignal) {
  return request<RecallResponse>(`/api/me/recall?${q({ t: token, q: query })}`, undefined, async () => (await fixtures()).fixtureRecall(query), signal);
}

export function saveSettings(token: string, body: SettingsBody) {
  return request<{ ok: boolean } & Partial<MeResponse["user"]>>(
    `/api/me/settings?${q({ t: token })}`,
    { method: "POST", body: JSON.stringify(body) },
    async () => ({ ok: true, ...body }),
  );
}

export function addMemory(token: string, body: NewMemoryBody) {
  return request<MemoryRow>(`/api/me/memories?${q({ t: token })}`, { method: "POST", body: JSON.stringify(body) }, async () => ({
    blobId: null,
    kind: "preference",
    text: body.text,
    createdAt: new Date().toISOString(),
    status: "queued",
    namespace: "mf/u-7f3a91",
    suiObjectId: null,
    endEpoch: null,
    walruscanUrl: null,
    suiscanUrl: null,
  }));
}
