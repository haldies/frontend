/**
 * Service for AI Form Agent operations
 * Handles form scanning, profile fetching, and form filling
 */

const API_BASE = 'http://localhost:8000';

interface FormField {
  index: number;
  type: string;
  labelText: string;
  hints: string;
  placeholder: string;
  isRequired: boolean;
  [key: string]: any;
}

interface FormData {
  id: string;
  fieldCount: number;
  fields: FormField[];
  [key: string]: any;
}

interface ScanResult {
  forms: FormData[];
  totalFields: number;
}

/**
 * Scan forms on current page
 */
export async function scanForms(): Promise<ScanResult | null> {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'sendMessageToContentScript',
      message: { type: 'SCAN_FORMS' },
    });

    if (response?.success && response?.response?.forms?.length > 0) {
      const forms = response.response.forms;
      const totalFields = forms.reduce((sum: number, f: any) => sum + f.fieldCount, 0);
      return { forms, totalFields };
    }
    
    return null;
  } catch (error) {
    console.error('Error scanning forms:', error);
    return null;
  }
}

/**
 * Get user profile from storage or API
 */
export async function getUserProfile(): Promise<Record<string, string>> {
  const userProfile: Record<string, string> = {};
  
  // Try storage first
  const chromeApi = (globalThis as any).chrome;
  if (chromeApi?.storage?.local) {
    try {
      const result = await chromeApi.storage.local.get('smartAutofillState/v1');
      const stateData = result['smartAutofillState/v1'];
      if (stateData?.profile) {
        Object.entries(stateData.profile).forEach(([key, value]: [string, any]) => {
          if (value?.value && value?.label) {
            userProfile[value.label] = value.value;
          }
        });
      }
    } catch (error) {
      console.error('Error reading storage:', error);
    }
  }

  // Fallback to API if storage is empty
  if (Object.keys(userProfile).length === 0) {
    try {
      const response = await fetch(`${API_BASE}/api/profile`);
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          const p = data.profile;
          if (p.fullName) userProfile['Nama Lengkap'] = p.fullName;
          if (p.email) userProfile['Email'] = p.email;
          if (p.phone) userProfile['Telepon'] = p.phone;
          if (p.placeOfBirth) userProfile['Tempat Lahir'] = p.placeOfBirth;
          if (p.university) userProfile['Universitas'] = p.university;
          if (p.aboutMe) userProfile['Tentang Saya'] = p.aboutMe;
          if (p.skills) userProfile['Keahlian'] = p.skills;
          if (p.experience && Array.isArray(p.experience)) {
            const expText = p.experience.map((exp: any, idx: number) => 
              `${idx + 1}. ${exp.role} di ${exp.company} (${exp.period})`
            ).join('; ');
            userProfile['Pengalaman Kerja'] = expText;
          }
        }
      }
    } catch (error) {
      console.warn('Could not fetch profile from API:', error);
    }
  }

  return userProfile;
}

/**
 * Generate AI answers for form fields
 */
export async function generateFormAnswers(
  fields: FormField[],
  profile: Record<string, string>
): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/api/agent/fill-form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, profile }),
  });

  if (!response.ok) {
    throw new Error('AI gagal generate jawaban');
  }

  const data = await response.json();
  return data.answers;
}

/**
 * Fill form with values
 */
export async function fillFormFields(
  formIndex: number,
  fields: Array<{ index: number; value: string }>
): Promise<boolean> {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'sendMessageToContentScript',
      message: {
        type: 'FILL_FORM',
        formIndex,
        fields,
      },
    });

    return response?.success === true;
  } catch (error) {
    console.error('Error filling form:', error);
    return false;
  }
}

/**
 * Complete workflow: scan, generate, and fill
 */
export async function scanAndFillForm(): Promise<{
  success: boolean;
  message: string;
  filledCount?: number;
}> {
  // 1. Scan forms
  const scanResult = await scanForms();
  if (!scanResult) {
    return {
      success: false,
      message: 'Tidak menemukan form di halaman ini',
    };
  }

  // 2. Get profile
  const profile = await getUserProfile();

  // 3. Generate answers
  const firstForm = scanResult.forms[0];
  const answers = await generateFormAnswers(firstForm.fields, profile);

  // 4. Fill form
  const fieldsToFill = firstForm.fields
    .map(field => ({
      index: field.index,
      value: answers[field.index.toString()] || '',
    }))
    .filter(f => f.value && f.value.trim());

  const success = await fillFormFields(0, fieldsToFill);

  if (success) {
    return {
      success: true,
      message: `Berhasil mengisi ${fieldsToFill.length} field!`,
      filledCount: fieldsToFill.length,
    };
  }

  return {
    success: false,
    message: 'Gagal mengisi form',
  };
}
