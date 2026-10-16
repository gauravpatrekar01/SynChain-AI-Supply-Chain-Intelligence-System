import axios from 'axios';
import { formatApiError } from './errorFormatter';

export function aiRequestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return 'The AI request took too long. Your draft is safe; try again shortly.';
    }
    if (error.response?.status === 429) {
      return 'The service has reached its request limit. Wait before trying again.';
    }
  }
  return formatApiError(error, 'The request could not be completed. Please try again.');
}

export function retryDelaySeconds(error: unknown): number {
  if (!axios.isAxiosError(error)) return 0;
  const raw = error.response?.headers?.['retry-after'];
  const seconds = Number(raw);
  if (raw != null && Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  if (typeof raw === 'string') {
    const timestamp = Date.parse(raw);
    if (Number.isFinite(timestamp)) return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  }
  return error.response?.status === 429 ? 60 : 0;
}
