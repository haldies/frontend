import type { FieldKey } from './keys';

export type FieldInputKind = 'text' | 'email' | 'tel' | 'textarea';

export interface FieldDefinition {
  label: string;
  placeholder: string;
  description: string;
  defaultValue: string;
  defaultEnabled: boolean;
  keywords: string[];
  inputKind: FieldInputKind;
  requireKeyword?: boolean;
}

export interface ProfileFieldState {
  key: FieldKey;
  label: string;
  placeholder: string;
  description: string;
  value: string;
  enabled: boolean;
  inputKind: FieldInputKind;
}

export interface AutoFillState {
  panelOpen: boolean;
  profile: Record<FieldKey, ProfileFieldState>;
}

export interface PersistedFieldState {
  value?: unknown;
  enabled?: unknown;
}

export interface PersistedState {
  panelOpen?: unknown;
  profile?: Partial<Record<FieldKey, PersistedFieldState>>;
}

export interface DetectedValueField {
  type: 'value';
  key: FieldKey;
  element: HTMLInputElement | HTMLTextAreaElement;
  score: number;
  matchedKeyword: boolean;
  matchedAutocomplete: boolean;
}

export type DetectedFieldMatch = DetectedValueField;

export type DetectionMap = Record<FieldKey, DetectedFieldMatch[]>;

export interface FieldMatchEvaluation {
  score: number;
  matchedKeyword: boolean;
  matchedAutocomplete: boolean;
  typeBoost: boolean;
}

export interface PanelSummary {
  readyCount: number;
  total: number;
}
