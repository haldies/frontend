import type { FieldKey } from '@/modules/autofill/types/keys';
import { getApiBaseUrl } from '@/modules/autofill/api/api';

export type ExtractedProfile = Partial<Record<FieldKey, string>>;

type ExtractApiResponse = {
  profile?: Record<string, string>;
  detail?: string;
};

/**
 * Uploads the PDF to the backend extraction service and returns the parsed profile.
 */
export async function extractProfileFromPdf(file: File): Promise<ExtractedProfile> {
  const endpoint = `${getApiBaseUrl()}/api/extract`;
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Gagal memproses PDF.';
    try {
      const errorBody = (await response.json()) as ExtractApiResponse;
      if (errorBody?.detail) {
        errorMessage = errorBody.detail;
      }
    } catch {
      // ignore parse errors and keep default message
    }
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as ExtractApiResponse;
  if (!payload?.profile || typeof payload.profile !== 'object') {
    throw new Error('Respons dari server tidak valid.');
  }

  return payload.profile as ExtractedProfile;
}
