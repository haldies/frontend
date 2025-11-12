import type { FieldKey } from '../types/keys';
import { ensureFieldConfigsReady, getFieldConfigKeysSync } from '../core/config';

type ProfileResponse = {
  profile?: Record<string, unknown>;
  detail?: string;
};

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
let cachedBaseUrl: string | null = null;
let profilePayloadCache: Record<string, unknown> | null = null;

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function normalizeValueForField(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const role = typeof record.role === 'string' ? record.role.trim() : '';
          const company = typeof record.company === 'string' ? record.company.trim() : '';
          const period = typeof record.period === 'string' ? record.period.trim() : '';
          const description =
            typeof record.description === 'string' ? record.description.trim() : '';
          const headline = [role, company, period].filter(Boolean).join(' • ');
          const details = [headline, description].filter(Boolean);
          if (details.length > 0) {
            return details.join('\n');
          }
          return '';
        }
        if (typeof item === 'string') {
          return item.trim();
        }
        if (typeof item === 'number' || typeof item === 'boolean') {
          return String(item);
        }
        return '';
      })
      .filter((item) => item.length > 0);
    return items.length > 0 ? items.join('\n') : undefined;
  }
  return undefined;
}

async function fetchProfilePayload(): Promise<Record<string, unknown>> {
  if (profilePayloadCache) {
    return profilePayloadCache;
  }

  const endpoint = `${getApiBaseUrl()}/api/profile`;
  let response: Response;

  try {
    response = await fetch(endpoint);
  } catch (error) {
    console.warn('Smart Autofill: gagal menghubungi API profile', error);
    throw new Error('Tidak dapat terhubung ke layanan profil.');
  }

  if (!response.ok) {
    console.warn('Smart Autofill: API profile mengembalikan status', response.status);
    throw new Error('Layanan profil tidak tersedia.');
  }

  let payload: ProfileResponse;
  try {
    payload = (await response.json()) as ProfileResponse;
  } catch (error) {
    console.warn('Smart Autofill: respons profile tidak valid', error);
    throw new Error('Data profil tidak valid.');
  }

  const source =
    payload && typeof payload === 'object'
      ? (payload.profile && typeof payload.profile === 'object'
          ? (payload.profile as Record<string, unknown>)
          : (payload as unknown as Record<string, unknown>))
      : {};

  profilePayloadCache = source ?? {};
  return profilePayloadCache;
}

export function getApiBaseUrl(): string {
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }

  const raw =
    (import.meta.env?.VITE_EXTRACTION_API_URL as string | undefined) ?? DEFAULT_API_BASE_URL;
  cachedBaseUrl = normalizeUrl(raw);
  return cachedBaseUrl;
}

export function getCachedProfilePayload(): Record<string, unknown> | null {
  return profilePayloadCache;
}

export async function ensureProfilePayload(): Promise<Record<string, unknown>> {
  return fetchProfilePayload();
}

export async function fetchProfileTemplate(): Promise<Partial<Record<FieldKey, string>>> {
  await ensureFieldConfigsReady();
  const source = await fetchProfilePayload();
  const result: Partial<Record<FieldKey, string>> = {};
  const keys = getFieldConfigKeysSync();

  keys.forEach((key) => {
    const normalized = normalizeValueForField(source[key]);
    if (typeof normalized === 'string' && normalized.trim().length > 0) {
      result[key] = normalized;
    }
  });

  return result;
}
