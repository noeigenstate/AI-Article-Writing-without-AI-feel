const lastRunAt = new Map<string, number>();
const providerQueues = new Map<string, Promise<void>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitForProvider(provider: string, minSpacingMs: number): Promise<void> {
  const previous = providerQueues.get(provider) ?? Promise.resolve();

  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const now = Date.now();
      const lastRun = lastRunAt.get(provider) ?? 0;
      const waitMs = Math.max(0, lastRun + minSpacingMs - now);

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      lastRunAt.set(provider, Date.now());
    });

  providerQueues.set(provider, next);
  return next;
}
