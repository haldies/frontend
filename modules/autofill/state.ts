import { FIELD_KEYS } from './keys';
import { createDefaultProfile } from './config';
import type { AutoFillState, DetectionMap, PersistedState, ProfileFieldState } from './types';
import type { FieldKey } from './keys';

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

  FIELD_KEYS.forEach((key) => {
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

  FIELD_KEYS.forEach((key) => {
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
  FIELD_KEYS.forEach((key) => {
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
  FIELD_KEYS.forEach((key) => {
    map[key] = [];
  });
  return map;
}

export function countReadyMatches(detections: DetectionMap): number {
  return FIELD_KEYS.reduce((count, key) => {
    const matches = detections[key];
    return matches && matches.length > 0 ? count + 1 : count;
  }, 0);
}

export function getFieldKeys(): FieldKey[] {
  return [...FIELD_KEYS];
}
