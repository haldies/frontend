import { getAllFieldsFromDb } from './indexedDb';
import { DEFAULT_FIELD_KEYS, isDefaultFieldKey, type FieldKey } from './keys';
import type { FieldDefinition, ProfileFieldState } from './types';

export const STORAGE_KEY = 'smartAutofillState/v1';
export const MIN_DETECTION_SCORE = 38;

export const DEFAULT_FIELD_CONFIGS: Record<FieldKey, FieldDefinition> = {
  fullName: {
    label: 'Nama Lengkap',
    placeholder: 'Contoh: Budi Santoso',
    description: 'Mengisi kolom nama lengkap pada formulir.',
    defaultValue: '',
    defaultEnabled: true,
    keywords: ['fullname', 'full_name', 'full name', 'name', 'nama', 'nama lengkap', 'person_name',],
    inputKind: 'text',
    requireKeyword: true,
  },
  email: {
    label: 'Email',
    placeholder: 'Contoh: budi@example.com',
    description: 'Mengisi kolom email atau alamat surat elektronik.',
    defaultValue: '',
    defaultEnabled: true,
    keywords: ['email', 'e-mail', 'mail', 'alamat email'],
    inputKind: 'email',
  }
};

let cachedFieldConfigs: Record<FieldKey, FieldDefinition> = cloneFieldConfigs(DEFAULT_FIELD_CONFIGS);
let cachedFieldKeys: FieldKey[] = resolveFieldConfigKeys(cachedFieldConfigs);
let initialized = false;
let initPromise: Promise<Record<FieldKey, FieldDefinition>> | null = null;

type FieldConfigListener = (payload: {
  configs: Record<FieldKey, FieldDefinition>;
  keys: FieldKey[];
}) => void;

const listeners = new Set<FieldConfigListener>();

export async function ensureFieldConfigsReady(): Promise<Record<FieldKey, FieldDefinition>> {
  if (initialized) {
    return cachedFieldConfigs;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    refreshCachedFieldConfigs(cloneFieldConfigs(DEFAULT_FIELD_CONFIGS));
    initialized = true;
    return cachedFieldConfigs;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function getFieldConfigsSync(): Record<FieldKey, FieldDefinition> {
  return cachedFieldConfigs;
}

export function getFieldConfigKeysSync(): FieldKey[] {
  return [...cachedFieldKeys];
}

export function getFieldConfig(key: FieldKey): FieldDefinition | undefined {
  return cachedFieldConfigs[key];
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
  rawKey: FieldKey,
  definition: FieldDefinition,
): Promise<FieldDefinition> {
  await ensureFieldConfigsReady();

  const key = normaliseFieldKey(rawKey);
  const nextDefinition = normaliseFieldDefinition({
    ...definition,
    label: definition.label || key,
    placeholder: definition.placeholder ?? '',
    description: definition.description ?? '',
    defaultValue: definition.defaultValue ?? '',
    defaultEnabled: Boolean(definition.defaultEnabled),
    inputKind: definition.inputKind ?? 'text',
    requireKeyword: definition.requireKeyword ?? false,
  });

  const nextConfigs = {
    ...cachedFieldConfigs,
    [key]: nextDefinition,
  };

  refreshCachedFieldConfigs(nextConfigs);
  return cachedFieldConfigs[key];
}

export function createDefaultProfile(
  initialValues: Partial<Record<FieldKey, string>> = {},
): Record<FieldKey, ProfileFieldState> {
  const configs = getFieldConfigsSync();
  const keys = getFieldConfigKeysSync();
  const profile = {} as Record<FieldKey, ProfileFieldState>;

  keys.forEach((key) => {
    const config = configs[key] ?? DEFAULT_FIELD_CONFIGS[key];
    profile[key] = {
      key,
      label: config.label,
      placeholder: config.placeholder,
      description: config.description,
      value: initialValues[key] ?? config.defaultValue ?? '',
      enabled: config.defaultEnabled,
      inputKind: config.inputKind,
    };
  });

  return profile;
}


export async function mergeWithDefaults(stored: FieldDefinition[]): Promise<Record<FieldKey, FieldDefinition>> {
  const merged = cloneFieldConfigs(DEFAULT_FIELD_CONFIGS);

  const indexedDbFields = await getAllFieldsFromDb(); 

  stored.forEach((item) => {
    const key = normaliseFieldKey(item.key as FieldKey);
    const fallback = merged[key];

    
    const dbField = indexedDbFields.find(field => field.label === item.label); 

    merged[key] = normaliseFieldDefinition({
      label: dbField?.label ?? fallback?.label ?? key,  
      placeholder: item.placeholder ?? fallback?.placeholder ?? '',
      description: item.description ?? fallback?.description ?? '',
      defaultValue: item.defaultValue ?? fallback?.defaultValue ?? '',
      defaultEnabled: typeof item.defaultEnabled === 'boolean' ? item.defaultEnabled : fallback?.defaultEnabled ?? false,
      keywords: dbField?.keywords ?? fallback?.keywords ?? [], 
      inputKind: item.inputKind ?? fallback?.inputKind ?? 'text',
      requireKeyword: typeof item.requireKeyword === 'boolean' ? item.requireKeyword : fallback?.requireKeyword ?? false,
    });
  });
  refreshCachedFieldConfigs(merged);
  console.log('Merged Field Configs:', merged);
  return merged;
}

function cloneFieldConfigs(source: Record<FieldKey, FieldDefinition>): Record<FieldKey, FieldDefinition> {
  const cloned = {} as Record<FieldKey, FieldDefinition>;
  Object.entries(source).forEach(([rawKey, config]) => {
    const key = rawKey as FieldKey;
    if (!config) {
      return;
    }
    cloned[key] = {
      ...config,
      keywords: [...config.keywords],
    };
  });
  return cloned;
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

function normaliseFieldKey(raw: FieldKey): FieldKey {
  const base = String(raw ?? '').trim();
  if (!base) {
    throw new Error('Field key tidak boleh kosong');
  }

  if (isDefaultFieldKey(base)) {
    return base;
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

function resolveFieldConfigKeys(source: Record<FieldKey, FieldDefinition>): FieldKey[] {
  const keys = Object.keys(source) as FieldKey[];
  const defaults = DEFAULT_FIELD_KEYS.filter((key) => keys.includes(key as FieldKey)) as FieldKey[];
  const extras = keys.filter((key) => !defaults.includes(key)).sort();
  return [...defaults, ...extras];
}

function refreshCachedFieldConfigs(next: Record<FieldKey, FieldDefinition>): void {
  cachedFieldConfigs = next;
  cachedFieldKeys = resolveFieldConfigKeys(next);
  notifyFieldConfigListeners();
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
