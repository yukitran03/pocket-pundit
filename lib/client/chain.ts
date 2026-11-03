// Explorer links and Walrus epoch helpers (client-safe, no secrets).

export const walruscanBlob = (blobId: string) => `https://walruscan.com/mainnet/blob/${encodeURIComponent(blobId)}`;
export const suiscanObject = (id: string) => `https://suiscan.xyz/mainnet/object/${id}`;
export const suiscanAccount = (addr: string) => `https://suiscan.xyz/mainnet/account/${addr}`;

/**
 * Walrus mainnet uses 14-day storage epochs. MeResponse has no "current Walrus epoch" field, so
 * when the API doesn't supply `currentWalrusEpoch` we estimate it from the epoch-1 start
 * (mainnet launch, late March 2025). The UI marks estimated values with "≈".
 */
const WALRUS_EPOCH_1_START = Date.UTC(2025, 2, 25);
const WALRUS_EPOCH_MS = 14 * 24 * 3600 * 1000;

export function estimateWalrusEpoch(now = Date.now()) {
  return Math.max(1, Math.floor((now - WALRUS_EPOCH_1_START) / WALRUS_EPOCH_MS) + 1);
}

/** 1 = fresh, 0 = expired. Fades linearly over the final `fadeEpochs` epochs. */
export function lifeLeft(endEpoch: number | null, current: number, fadeEpochs = 3) {
  if (endEpoch === null) return 1;
  const left = endEpoch - current;
  if (left <= 0) return 0;
  return Math.min(1, left / fadeEpochs);
}
