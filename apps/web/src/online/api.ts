// Minimal typed client for the Chronokid API (same origin, proxied to the API in development).
import type {
  ApiErrorCode, CreatePlayerResponse, FinishRunRequest, FinishRunResponse, LeaderboardResponse,
  StartRunRequest, StartRunResponse, UpdatePlayerRequest, UpdatePlayerResponse
} from '@chronokid/shared';

const TIMEOUT_MS = 5000;

/** The API could not be reached or failed on its side; the game should carry on offline. */
export class ApiUnavailable extends Error {}

/** The API understood the request and refused it (4xx). */
export class ApiRejected extends Error {
  constructor(readonly status: number, readonly code: ApiErrorCode | 'unknown') {
    super(code);
  }
}

async function request<T>(method: string, path: string, options: { token?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch {
    throw new ApiUnavailable('network');
  }
  if (response.status >= 500 || response.status === 429) throw new ApiUnavailable(String(response.status));
  if (!response.ok) {
    const code = await response.json().then((body: { error?: ApiErrorCode }) => body.error ?? 'unknown', () => 'unknown' as const);
    throw new ApiRejected(response.status, code);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiUnavailable('bad response');
  }
}

export const api = {
  createPlayer: (displayName: string) => request<CreatePlayerResponse>('POST', '/api/players', { body: { displayName } }),
  updatePlayer: (token: string, body: UpdatePlayerRequest) => request<UpdatePlayerResponse>('PATCH', '/api/players/me', { token, body }),
  startRun: (token: string, body: StartRunRequest = {}) => request<StartRunResponse>('POST', '/api/runs', { token, body }),
  finishRun: (token: string, runId: string, body: FinishRunRequest) =>
    request<FinishRunResponse>('POST', `/api/runs/${encodeURIComponent(runId)}/finish`, { token, body }),
  leaderboard: (limit = 10) => request<LeaderboardResponse>('GET', `/api/leaderboard?limit=${limit}`)
};
