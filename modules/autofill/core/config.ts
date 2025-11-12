import { type FieldKey, type FieldId } from '../types/keys';
import type { FieldDefinition, ProfileFieldState } from '../types/types';
import { fieldConfigApi } from '../api/fieldConfigApi';

// Hardcoded placeholder mapping based on field ID and label
function getHardcodedPlaceholder(key: string, label: string): string {
  const labelLower = label.toLowerCase();

  if (labelLower.includes('nama') || labelLower.includes('name')) {
    return 'Contoh: Budi Santoso';
  } else if (labelLower.includes('email')) {
    return 'Contoh: budi@example.com';
  } else if (labelLower.includes('telepon') || labelLower.includes('phone') || labelLower.includes('hp')) {
    return 'Contoh: 08123456789';
  } else if (labelLower.includes('alamat') || labelLower.includes('address')) {
    return 'Contoh: Jl. Merdeka No. 123';
  } else if (labelLower.includes('pengalaman') || labelLower.includes('experience')) {
    return 'Contoh: Software Engineer di PT Tech Indonesia';
  } else if (labelLower.includes('pendidikan') || labelLower.includes('education')) {
    return 'Contoh: S1 Teknik Informatika';
  } else if (labelLower.includes('keahlian') || labelLower.includes('skill')) {
    return 'Contoh: JavaScript, Python, React';
  } else if (labelLower.includes('tanggal') || labelLower.includes('date') || labelLower.includes('lahir')) {
    return 'Contoh: 01/01/1990';
  } else if (labelLower.includes('website')) {
    return 'Contoh: https://portofolio-saya.com';
  } else if (labelLower.includes('linkedin')) {
    return 'Contoh: https://linkedin.com/in/nama-anda';
  } else if (labelLower.includes('github')) {
    return 'Contoh: https://github.com/username';
  }

  return `Masukkan ${labelLower}`;
}

export const STORAGE_KEY = 'smartAutofillState/v1';
export const MIN_DETECTION_SCORE = 38;

let cachedFieldConfigs: Record<string, FieldDefinition> = {} as Record<string, FieldDefinition>;
let cachedFieldKeys: string[] = [];
let initialized = false;
let initPromise: Promise<Record<string, FieldDefinition>> | null = null;

type FieldConfigListener = (payload: {
  configs: Record<string, FieldDefinition>;
  keys: string[];
}) => void;

const listeners = new Set<FieldConfigListener>();

export async function ensureFieldConfigsReady(): Promise<Record<string, FieldDefinition>> {
  console.log('🔧 ensureFieldConfigsReady called, initialized:', initialized);

  if (initialized) {
    console.log('ℹ️ Already initialized, returning cached configs');
    // Refresh configs even if already initialized to get latest data
    const refreshedConfigs = await loadFieldConfigsWithCustomFields();
    refreshCachedFieldConfigs(refreshedConfigs);
    return cachedFieldConfigs;
  }

  if (initPromise) {
    console.log('⏳ Initialization in progress, waiting...');
    return initPromise;
  }

  initPromise = (async () => {
    console.log('🔄 Starting field configs initialization...');
    const initialConfigs = await loadFieldConfigsWithCustomFields();
    refreshCachedFieldConfigs(initialConfigs);

    initialized = true;
    console.log('✅ Field configs initialization completed');
    return cachedFieldConfigs;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function getFieldConfigsSync(): Record<string, FieldDefinition> {
  return cachedFieldConfigs;
}

export function getFieldConfigKeysSync(): string[] {
  return [...cachedFieldKeys];
}

export function getFieldConfig(id: string): FieldDefinition | undefined {
  return cachedFieldConfigs[id];
}

export function subscribeToFieldConfigChanges(listener: FieldConfigListener): () => void {
  listeners.add(listener);
  try {
    listener({ configs: cachedFieldConfigs, keys: cachedFieldKeys });
  } catch (error) {
    console.warn('Smart Autofill: listener konfigurasi field error saat subscribe', error);
  }
  return () => {
    listeners.delete(listener);
  };
}

export async function saveFieldConfig(
  id: string,
  definition: FieldDefinition,
): Promise<FieldDefinition> {
  await ensureFieldConfigsReady();

  const nextDefinition = normaliseFieldDefinition({
    ...definition,
    label: definition.label || `Field ${id}`,
    placeholder: getHardcodedPlaceholder(id, definition.label || `Field ${id}`), // Use hardcoded placeholder
    description: definition.description ?? '',
    defaultValue: definition.defaultValue ?? '',
    defaultEnabled: Boolean(definition.defaultEnabled),
    inputKind: definition.inputKind ?? 'text',
    requireKeyword: definition.requireKeyword ?? false,
  });

  const nextConfigs = {
    ...cachedFieldConfigs,
    [id]: nextDefinition,
  };

  refreshCachedFieldConfigs(nextConfigs);
  return cachedFieldConfigs[id];
}

export function createDefaultProfile(
  initialValues: Partial<Record<string, string>> = {},
): Record<string, ProfileFieldState> {
  const configs = getFieldConfigsSync();
  const keys = getFieldConfigKeysSync();
  const profile = {} as Record<string, ProfileFieldState>;

  keys.forEach((key) => {
    const config = configs[key];
    if (!config) {
      return; // Skip if no config found
    }
    profile[key] = {
      key,
      label: config.label,
      placeholder: getHardcodedPlaceholder(key, config.label), // Use hardcoded placeholder
      description: config.description,
      value: initialValues[key] ?? config.defaultValue ?? '',
      enabled: config.defaultEnabled,
      inputKind: config.inputKind,
    };
  });

  return profile;
}


function normaliseFieldDefinition(definition: FieldDefinition): FieldDefinition {
  const processed =
    Array.isArray(definition.keywords)
      ? definition.keywords
          .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
          .filter((keyword) => keyword.length > 0)
      : [];

  return {
    ...definition,
    keywords: Array.from(new Set(processed)),
  };
}

function normaliseFieldKey(raw: FieldId): FieldId {
  const base = String(raw ?? '').trim();
  if (!base) {
    throw new Error('Field key tidak boleh kosong');
  }

  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    throw new Error('Field key tidak valid');
  }

  return normalized;
}

function resolveFieldConfigKeys(source: Record<string, FieldDefinition>): string[] {
  const keys = Object.keys(source);
  return keys.sort(); // Sort alphabetically for string keys
}

function refreshCachedFieldConfigs(next: Record<string, FieldDefinition>): void {
  cachedFieldConfigs = next;
  cachedFieldKeys = resolveFieldConfigKeys(next);
  notifyFieldConfigListeners();
}

async function loadFieldConfigsWithCustomFields(): Promise<Record<string, FieldDefinition>> {
  try {
    console.log('🔄 Loading field configurations from API...');
    const apiFields = await fieldConfigApi.getAllFields();

    if (apiFields.length === 0) {
      console.log('⚠️ No fields from API, returning empty configuration');
      return {} as Record<string, FieldDefinition>;
    }

    const configs: Record<string, FieldDefinition> = {} as Record<string, FieldDefinition>;

    apiFields.forEach((field) => {
      // Use string key (converted from numeric id) for consistency
      const key = String(field.id);
      configs[key] = {
        ...field,
        placeholder: getHardcodedPlaceholder(key, field.label), // Use hardcoded placeholder
        keywords: [...(field.keywords || [])],
      };
    });

    console.log(`✅ Loaded ${apiFields.length} field configurations from API`);
    return configs;
  } catch (error) {
    console.error('❌ Failed to load field configurations from API:', error);
    console.log('📦 Returning empty configuration due to API failure');
    return {} as Record<string, FieldDefinition>;
  }
}

export function setupIndexedDbChangeListener(): void {
  console.log('ℹ️ IndexedDB support has been removed - custom fields functionality disabled');
}

export async function manualRefreshConfigs(): Promise<void> {
  console.log('🔄 Manual refresh of field configs...');
  try {
    const updatedConfigs = await loadFieldConfigsWithCustomFields();
    console.log('✅ Manual refresh - loaded configs:', Object.keys(updatedConfigs));
    refreshCachedFieldConfigs(updatedConfigs);
    console.log('🎯 Manual refresh - configs cached and listeners notified');
  } catch (error) {
    console.error('❌ Manual refresh failed:', error);
  }
}

export async function refreshConfigsFromApi(): Promise<void> {
  console.log('🔄 Refreshing configs from API...');
  try {
    const apiConfigs = await loadFieldConfigsWithCustomFields();
    refreshCachedFieldConfigs(apiConfigs);
    console.log('✅ Successfully refreshed configs from API');
  } catch (error) {
    console.error('❌ Failed to refresh configs from API:', error);
    throw error;
  }
}

function notifyFieldConfigListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener({ configs: cachedFieldConfigs, keys: cachedFieldKeys });
    } catch (error) {
      console.warn('Smart Autofill: listener konfigurasi field error', error);
    }
  });
}
