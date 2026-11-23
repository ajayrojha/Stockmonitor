// Shared JSON fetch through the free public CORS proxies.
//
// The proxies are flaky (cors.lol rate-limits per IP with 429s, allorigins is
// often slow or times out), so requests are "hedged":
//   - The first request of the session goes to all proxies at once and the
//     first valid response wins — fastest possible first paint.
//   - After that, requests go to the proxy that last worked. If it fails or
//     hasn't answered within HEDGE_DELAY_MS, the other proxies are tried in
//     parallel and the first valid response wins.
// The winning proxy becomes the preferred one for the next request.

// corsproxy.io excluded — it 401s on every request without a paid API key.
const PROXIES = [
  'https://api.cors.lol/?url=',
  'https://api.allorigins.win/raw?url=',
];

const HEDGE_DELAY_MS = 2500;
const TIMEOUT_MS = 12000;

let preferred = -1; // -1 = unknown yet → race all proxies immediately

const tryProxy = async (idx: number, url: string, signal: AbortSignal): Promise<{ idx: number; json: unknown }> => {
  const res = await fetch(PROXIES[idx] + encodeURIComponent(url), { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} via ${PROXIES[idx]}`);
  return { idx, json: await res.json() };
};

/** Fetch `url` as JSON through whichever CORS proxy responds first. */
export async function fetchJsonViaProxy<T = unknown>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const order = preferred < 0
    ? PROXIES.map((_, i) => i)
    : [preferred, ...PROXIES.map((_, i) => i).filter(i => i !== preferred)];

  try {
    const winner = await new Promise<{ idx: number; json: unknown }>((resolve, reject) => {
      let started = 0;
      let failed = 0;
      const errors: unknown[] = [];
      const start = (i: number) => {
        started++;
        tryProxy(i, url, controller.signal).then(resolve, err => {
          errors.push(err);
          failed++;
          if (started < order.length) startRest(); // fail fast → hedge now
          else if (failed === started) reject(new AggregateError(errors, 'All CORS proxies failed'));
        });
      };
      let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
      const startRest = () => {
        clearTimeout(hedgeTimer);
        while (started < order.length) start(order[started]);
      };
      if (preferred < 0) startRest();
      else {
        start(order[0]);
        hedgeTimer = setTimeout(startRest, HEDGE_DELAY_MS);
      }
    });
    preferred = winner.idx;
    return winner.json as T;
  } finally {
    clearTimeout(timeout);
    controller.abort(); // cancel the losing requests
  }
}

/** Call when a proxy answered but with stale (cached) data, to rotate away from it. */
export function reportStaleProxy() {
  if (preferred >= 0) preferred = (preferred + 1) % PROXIES.length;
}
