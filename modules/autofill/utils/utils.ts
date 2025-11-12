import type { FieldKey } from '../types/keys';
import type { DetectionMap } from '../types/types';

export function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

export function applyValueToElement(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  force: boolean,
): void {
  const currentValue = element.value ?? '';

  if (!force && currentValue.trim().length > 0 && currentValue.trim() !== value.trim()) {
    return;
  }

  element.value = value;
  element.setAttribute('data-smart-autofill', 'applied');
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function normaliseText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function cloneEmptyDetectionMap(template: DetectionMap): DetectionMap {
  const clone = {} as DetectionMap;
  Object.keys(template).forEach((key) => {
    clone[key as FieldKey] = [];
  });
  return clone;
}
