import { getAccessTokenExpiryMs, refreshAccessToken, clearTokens, isLoggedIn } from "./auth";

const REFRESH_BUFFER_MS = 60_000; // keep in sync with REFRESH_BUFFER_SECONDS in auth.ts

let timer: ReturnType<typeof setTimeout> | null = null;

async function tick(onLoggedOut: () => void) {
  if (!isLoggedIn()) return;

  const expiry = getAccessTokenExpiryMs();
  if (!expiry) {
    clearTokens();
    onLoggedOut();
    return;
  }

  const msUntilRefresh = expiry - Date.now() - REFRESH_BUFFER_MS;

  if (msUntilRefresh <= 0) {
    const ok = await refreshAccessToken();
    if (!ok) {
      clearTokens();
      onLoggedOut();
      return;
    }
    scheduleNext(onLoggedOut); // refreshed — schedule based on the new token's expiry
    return;
  }

  timer = setTimeout(() => tick(onLoggedOut), msUntilRefresh);
}

function scheduleNext(onLoggedOut: () => void) {
  if (timer) clearTimeout(timer);
  tick(onLoggedOut);
}

export function startTokenScheduler(onLoggedOut: () => void) {
  scheduleNext(onLoggedOut);
}

export function stopTokenScheduler() {
  if (timer) clearTimeout(timer);
  timer = null;
}