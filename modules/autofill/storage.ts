import { STORAGE_KEY, ensureFieldConfigsReady } from './config';
import { getDefaultState, mergeState, toPersistedState } from './state';
import { fetchProfileTemplate } from './api';
import type { FieldKey } from './keys';
import type { AutoFillState, PersistedState } from './types';

type ExtensionStorage = {
  get: (keys: unknown, callback?: (items: Record<string, unknown>) => void) => Promise<Record<string, unknown>> | void;
  set: (items: Record<string, unknown>, callback?: () => void) => Promise<void> | void;
};

type StorageChangeEvents = {
  addListener: (
    callback: (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      areaName: string,
    ) => void,
  ) => void;
  removeListener: (
    callback: (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      areaName: string,
    ) => void,
  ) => void;
};

type RuntimeMessageListener = (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => void;

type RuntimeMessageEvents = {
  addListener: (callback: RuntimeMessageListener) => void;
  removeListener: (callback: RuntimeMessageListener) => void;
};

type RuntimeApi = {
  sendMessage?: (message: unknown, options?: unknown, callback?: (response?: unknown) => void) => Promise<unknown> | void;
  onMessage?: RuntimeMessageEvents;
};

const STATE_UPDATE_EVENT = 'smart-autofill:state-update';
let profileTemplateCache: Partial<Record<FieldKey, string>> | null = null;
let profileTemplatePromise: Promise<Partial<Record<FieldKey, string>>> | null = null;

async function resolveProfileTemplate(): Promise<Partial<Record<FieldKey, string>>> {
  if (profileTemplateCache) {
    return profileTemplateCache;
  }

  if (!profileTemplatePromise) {
    profileTemplatePromise = fetchProfileTemplate()
      .then((data) => {
        profileTemplateCache = data;
        return data;
      })
      .catch((error) => {
        console.warn('Smart Autofill: gagal memuat template profil', error);
        profileTemplateCache = {};
        return {};
      })
      .finally(() => {
        profileTemplatePromise = null;
      });
  }

  return profileTemplatePromise;
}

function getCachedTemplate(): Partial<Record<FieldKey, string>> {
  return profileTemplateCache ?? {};
}

export async function loadStateFromStorage(): Promise<AutoFillState> {
  await ensureFieldConfigsReady();
  const template = await resolveProfileTemplate();
  const defaultState = getDefaultState(template);
  const storage = getExtensionStorage();
  if (!storage) {
    return defaultState;
  }

  try {
    const persisted = await storageGet<PersistedState>(storage, STORAGE_KEY);
    return mergeState(defaultState, persisted);
  } catch (error) {
    console.warn('Smart Autofill: gagal memuat state', error);
    return defaultState;
  }
}

export async function saveStateToStorage(state: AutoFillState): Promise<void> {
  const storage = getExtensionStorage();
  if (!storage) {
    return;
  }

  try {
    await storageSet(storage, STORAGE_KEY, toPersistedState(state));
  } catch (error) {
    console.warn('Smart Autofill: gagal menyimpan state', error);
    return;
  }

  broadcastStateUpdate(state);
}

export function subscribeToStateChanges(listener: (state: AutoFillState) => void): () => void {
  const events = getStorageChangeEvents();
  if (!events) {
    return () => {};
  }

  const handler = (
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
    areaName: string,
  ) => {
    if (areaName !== 'local') {
      return;
    }

    const change = changes[STORAGE_KEY];
    if (!change) {
      return;
    }

    const merged = mergeState(
      getDefaultState(getCachedTemplate()),
      change.newValue as PersistedState | undefined,
    );
    listener(merged);
  };

  events.addListener(handler);

  return () => {
    try {
      events.removeListener(handler);
    } catch {
      // ignore unsubscribe errors
    }
  };
}

export function subscribeToStateMessages(listener: (state: AutoFillState) => void): () => void {
  const runtime = getRuntime();
  const events = runtime?.onMessage;
  if (!events) {
    return () => {};
  }

  const handler: RuntimeMessageListener = (message) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    const payload = message as { type?: string; state?: PersistedState | undefined };
    if (payload.type !== STATE_UPDATE_EVENT) {
      return;
    }

    const nextState = mergeState(getDefaultState(getCachedTemplate()), payload.state);
    listener(nextState);
  };

  events.addListener(handler);

  return () => {
    try {
      events.removeListener(handler);
    } catch {
      // ignore unsubscribe errors
    }
  };
}

function getExtensionStorage(): ExtensionStorage | null {
  const globalObj = globalThis as unknown as { browser?: unknown; chrome?: unknown };
  const api = (globalObj.browser ?? globalObj.chrome) as { storage?: unknown } | undefined;
  if (!api || typeof api !== 'object') {
    return null;
  }

  const storage = api.storage as { local?: ExtensionStorage } | undefined;
  if (!storage || typeof storage !== 'object') {
    return null;
  }

  const local = storage.local;
  if (!local || typeof local.get !== 'function' || typeof local.set !== 'function') {
    return null;
  }

  return local;
}

async function storageGet<T>(storage: ExtensionStorage, key: string): Promise<T | undefined> {
  try {
    const maybePromise = storage.get([key]);
    if (maybePromise && typeof (maybePromise as Promise<Record<string, unknown>>).then === 'function') {
      const result = await (maybePromise as Promise<Record<string, unknown>>);
      return (result?.[key] as T | undefined) ?? undefined;
    }

    return await new Promise<T | undefined>((resolve) => {
      storage.get([key], (items) => {
        resolve((items?.[key] as T | undefined) ?? undefined);
      });
    });
  } catch (error) {
    console.warn('Smart Autofill: storage.get error', error);
    return undefined;
  }
}

async function storageSet(storage: ExtensionStorage, key: string, value: unknown): Promise<void> {
  try {
    const maybePromise = storage.set({ [key]: value });
    if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
      await maybePromise;
      return;
    }

    await new Promise<void>((resolve) => {
      storage.set({ [key]: value }, () => resolve());
    });
  } catch (error) {
    console.warn('Smart Autofill: storage.set error', error);
  }
}

function getStorageChangeEvents(): StorageChangeEvents | null {
  const globalObj = globalThis as unknown as {
    browser?: { storage?: { onChanged?: StorageChangeEvents } };
    chrome?: { storage?: { onChanged?: StorageChangeEvents } };
  };

  const browserEvents = globalObj.browser?.storage?.onChanged;
  if (browserEvents && typeof browserEvents.addListener === 'function') {
    return browserEvents;
  }

  const chromeEvents = globalObj.chrome?.storage?.onChanged;
  if (chromeEvents && typeof chromeEvents.addListener === 'function') {
    return chromeEvents;
  }

  return null;
}

function getRuntime(): RuntimeApi | null {
  const globalObj = globalThis as unknown as {
    browser?: { runtime?: RuntimeApi };
    chrome?: { runtime?: RuntimeApi };
  };

  return globalObj.browser?.runtime ?? globalObj.chrome?.runtime ?? null;
}

function broadcastStateUpdate(state: AutoFillState): void {
  const runtime = getRuntime();
  if (!runtime?.sendMessage) {
    return;
  }

  const payload = {
    type: STATE_UPDATE_EVENT,
    state: toPersistedState(state),
  };

  try {
    const maybePromise = runtime.sendMessage(payload);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
      void (maybePromise as Promise<unknown>).catch(() => {
        /* ignore send errors */
      });
    }
  } catch {
    // ignore send errors
  }
}
