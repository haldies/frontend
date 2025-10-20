export type ExtractionStatus = 'idle' | 'processing' | 'success' | 'error';

export type TabId = 'overview' | 'fields';

export interface StatusMeta {
  label: string;
  tone: string;
  highlight: string;
}
