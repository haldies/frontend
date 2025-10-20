import { FIELD_KEYS, type FieldKey } from './keys';

type ProfileResponse = {
  profile?: Record<string, unknown>;
  detail?: string;
};

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
let cachedBaseUrl: string | null = null;

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
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

export async function fetchProfileTemplate(): Promise<Partial<Record<FieldKey, string>>> {
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

  const source = (payload?.profile && typeof payload.profile === 'object'
    ? payload.profile
    : payload) as Record<string, unknown> | undefined;

  const result: Partial<Record<FieldKey, string>> = {};
  if (!source) {
    return result;
  }

  FIELD_KEYS.forEach((key) => {
    const value = source[key];
    if (typeof value === 'string') {
      result[key] = value;
    }
  });

  return result;
}
