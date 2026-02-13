import { apiFetch } from '../api/fetcher';

type TrackPayload = {
  name: string;
  properties?: Record<string, unknown>;
  occurredAt?: string;
};

export async function trackEvent(
  host: string | null,
  name: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  if (!host) {
    return;
  }

  const payload: TrackPayload = {
    name,
    occurredAt: new Date().toISOString(),
    ...(properties ? { properties } : {}),
  };

  try {
    await apiFetch('/v1/events', {
      host,
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return;
  }
}
