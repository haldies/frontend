import type { FieldKey, FieldId } from './keys';

export type FieldInputKind = 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'date' | 'password' | 'url';

export interface FieldDefinition {
  id: number; // Changed to numeric ID
  label: string;
  placeholder?: string; // Made optional - will be hardcoded in frontend
  description: string;
  defaultValue: string;
  defaultEnabled: boolean;
  keywords: string[];
  inputKind: FieldInputKind;
  requireKeyword?: boolean;
}

export interface ProfileFieldState {
  key: string; // Use string key for consistency with FieldKey
  label: string;
  placeholder: string;
  description: string;
  value: string;
  enabled: boolean;
  inputKind: FieldInputKind;
}

export interface AutoFillState {
  panelOpen: boolean;
  profile: Record<string, ProfileFieldState>; // Use string keys for compatibility
}

export interface PersistedFieldState {
  value?: unknown;
  enabled?: unknown;
}

export interface PersistedState {
  panelOpen?: unknown;
  profile?: Partial<Record<string, PersistedFieldState>>; // Use string keys for compatibility
}

export interface DetectedValueField {
  type: 'value';
  key: string; // Use string key for consistency with FieldKey
  element: HTMLInputElement | HTMLTextAreaElement;
  score: number;
  matchedKeyword: boolean;
  matchedAutocomplete: boolean;
}

export type DetectedFieldMatch = DetectedValueField;

export type DetectionMap = Record<string, DetectedFieldMatch[]>; // Use string keys for compatibility

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
