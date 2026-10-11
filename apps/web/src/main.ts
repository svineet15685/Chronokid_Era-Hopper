import type { ApiHealth } from '@chronokid/shared';
import './style.css';

const apiStatus = document.querySelector<HTMLElement>('#api-status');

async function checkApi(): Promise<void> {
  if (!apiStatus) return;

  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error('API returned an error');

    const health = (await response.json()) as ApiHealth;
    apiStatus.textContent = health.status === 'ok' ? 'ONLINE' : 'UNAVAILABLE';
    apiStatus.classList.toggle('pending', health.status !== 'ok');
  } catch {
    apiStatus.textContent = 'OFFLINE';
    apiStatus.classList.add('pending');
  }
}

void checkApi();