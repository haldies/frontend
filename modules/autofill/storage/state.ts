import { createDefaultProfile, getFieldConfigKeysSync } from '../core/config';
import type { AutoFillState, DetectionMap, PersistedState, ProfileFieldState } from '../types/types';
import type { FieldKey } from '../types/keys';

export function getDefaultState(initialValues?: Partial<Record<FieldKey, string>>): AutoFillState {
  return {
    panelOpen: true,
    profile: createDefaultProfile(initialValues),
  };
}

export function mergeState(base: AutoFillState, persisted: PersistedState | undefined): AutoFillState {
  const next: AutoFillState = {
    panelOpen: base.panelOpen,
    profile: {} as Record<FieldKey, ProfileFieldState>,
  };
  const keys = getFieldConfigKeysSync();

  keys.forEach((key) => {
    const sourceField = base.profile[key];
    next.profile[key] = { ...sourceField };
  });

  if (!persisted) {
    return next;
  }

  if (typeof persisted.panelOpen === 'boolean') {
    next.panelOpen = persisted.panelOpen;
  } else {
    next.panelOpen = base.panelOpen;
  }

  keys.forEach((key) => {
    const baseField = base.profile[key];
    const targetField = next.profile[key];
    const storedField = persisted.profile?.[key];

    if (!storedField) {
      targetField.enabled = baseField.enabled;
      targetField.value = baseField.value;
      return;
    }

    targetField.enabled =
      typeof storedField.enabled === 'boolean' ? (storedField.enabled as boolean) : baseField.enabled;
    targetField.value =
      typeof storedField.value === 'string' ? (storedField.value as string) : baseField.value;
  });

  return next;
}

export function toPersistedState(state: AutoFillState): PersistedState {
  const profile = {} as PersistedState['profile'];
  const keys = Object.keys(state.profile) as FieldKey[];
  keys.forEach((key) => {
    profile![key] = {
      enabled: state.profile[key].enabled,
      value: state.profile[key].value,
    };
  });

  return {
    panelOpen: state.panelOpen,
    profile,
  };
}

export function createEmptyDetectionMap(): DetectionMap {
  const map = {} as DetectionMap;
  getFieldConfigKeysSync().forEach((key) => {
    map[key] = [];
  });
  return map;
}

export function countReadyMatches(detections: DetectionMap): number {
  return getFieldConfigKeysSync().reduce((count, key) => {
    const matches = detections[key];
    return matches && matches.length > 0 ? count + 1 : count;
  }, 0);
}

export function getFieldKeys(): FieldKey[] {
  return getFieldConfigKeysSync();
}
