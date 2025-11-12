import type { FieldKey } from '../types/keys';
import { getFieldConfigKeysSync, getFieldConfigsSync, MIN_DETECTION_SCORE } from './config';
import { createEmptyDetectionMap } from '../storage/state';
import type { DetectionMap, DetectedFieldMatch, FieldDefinition, FieldMatchEvaluation } from '../types/types';
import { normaliseText } from '../utils/utils';

export function detectFormFields(root: Document = document): DetectionMap {
  const map: DetectionMap = createEmptyDetectionMap();
  const configs = getFieldConfigsSync();
  const keys = getFieldConfigKeysSync();

  console.log('🎯 Field Configs for Detection:', configs);
  console.log('🔑 Available Field Keys for Detection:', keys);

  // Log keywords for each field
  Object.entries(configs).forEach(([key, config]) => {
    console.log(`📝 ${config.label} (${key}): keywords = [${config.keywords.join(', ')}]`);
  });
  const candidates = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
  ).filter(isEligibleForAutofill);

  console.log('🔍 Smart Autofill: Starting form detection...');
  console.log(`📝 Found ${candidates.length} eligible form fields (input/textarea elements)`);

  // Group candidates by forms
  const formsMap = new Map<HTMLFormElement | null, (HTMLInputElement | HTMLTextAreaElement)[]>();

  candidates.forEach((element) => {
    const form = element.closest('form') as HTMLFormElement | null;
    if (!formsMap.has(form)) {
      formsMap.set(form, []);
    }
    formsMap.get(form)!.push(element);
  });

  // Log all detected forms
  console.log('📋 Forms detected on page:');
  console.group('📋 Detected Forms');

  formsMap.forEach((formFields, form) => {
    if (form) {
      console.log(`📄 Form: ${form.id || form.className || 'unnamed form'} (action: ${form.action || 'none'}, method: ${form.method || 'get'})`);
    } else {
      console.log('📄 Form fields outside any <form> element');
    }

    console.group('📝 Form Fields:');
    formFields.forEach((element, index) => {
      const fieldInfo = {
        index: index + 1,
        type: element instanceof HTMLInputElement ? element.type : 'textarea',
        id: element.id || 'no-id',
        name: element.name || 'no-name',
        placeholder: element.placeholder || 'no-placeholder',
        className: element.className || 'no-class',
        labelText: getElementLabelText(element, root),
        hints: collectElementHints(element, root),
        isRequired: element.hasAttribute('required'),
        autocomplete: element.getAttribute('autocomplete') || 'none'
      };

      console.log(`🔸 Field ${index + 1}:`, fieldInfo);
    });
    console.groupEnd();
  });
  console.groupEnd();

  candidates.forEach((element) => {
    const hintText = collectElementHints(element, root);

    let selectedKey: FieldKey | null = null;
    let selectedScore = -Infinity;
    let selectedMatchedKeyword = false;
    let selectedMatchedAutocomplete = false;

    keys.forEach((key) => {
      const config = configs[key];
      if (!config) {
        return;
      }
      const evaluation = evaluateElementForField(config, element, hintText);

      if (!shouldAcceptMatch(config, evaluation)) {
        return;
      }

      if (evaluation.score > selectedScore) {
        selectedKey = key;
        selectedScore = evaluation.score;
        selectedMatchedKeyword = evaluation.matchedKeyword;
        selectedMatchedAutocomplete = evaluation.matchedAutocomplete;
      }
    });

    if (selectedKey !== null) {
      const fieldKey = selectedKey as FieldKey;
      const typedMap = map as Record<FieldKey, DetectedFieldMatch[]>;
      const bucket = typedMap[fieldKey] ?? (typedMap[fieldKey] = []);
      bucket.push({
        type: 'value',
        key: fieldKey,
        element,
        score: selectedScore,
        matchedKeyword: selectedMatchedKeyword,
        matchedAutocomplete: selectedMatchedAutocomplete,
      });
    }
  });

  keys.forEach((key) => {
    map[key].sort((a, b) => b.score - a.score);
  });

  // Log detection results
  console.log('🎯 Detection Results:');
  console.group('🎯 Smart Autofill Detection Results');

  let totalMatches = 0;
  const detectedFields: Array<{
    fieldKey: string;
    label: string;
    matches: number;
    elements: Array<{
      type: string;
      hints: string;
      score: number;
      matchedKeyword: boolean;
      matchedAutocomplete: boolean;
    }>;
  }> = [];

  keys.forEach((key) => {
    const matches = map[key];
    if (matches.length > 0) {
      totalMatches += matches.length;
      const config = configs[key];
      detectedFields.push({
        fieldKey: key,
        label: config?.label || key,
        matches: matches.length,
        elements: matches.map(match => ({
          type: match.element instanceof HTMLInputElement ? match.element.type : 'textarea',
          hints: collectElementHints(match.element, root),
          score: match.score,
          matchedKeyword: match.matchedKeyword,
          matchedAutocomplete: match.matchedAutocomplete
        }))
      });
    }
  });

  if (detectedFields.length > 0) {
    console.log(`✅ Found ${totalMatches} matches across ${detectedFields.length} field types:`);
    detectedFields.forEach(field => {
      console.log(`🏷️  ${field.label} (${field.fieldKey}): ${field.matches} match(es)`);
      field.elements.forEach((element, idx) => {
        console.log(`   └─ Match ${idx + 1}: ${element.type} | Score: ${element.score} | Hints: "${element.hints}" | Keyword: ${element.matchedKeyword} | Autocomplete: ${element.matchedAutocomplete}`);
      });
    });
  } else {
    console.log('❌ No field matches found. Check if custom fields with keywords have been added.');
  }

  console.groupEnd();
  console.log('🔍 Smart Autofill: Detection completed');

  return map;
}

function isEligibleForAutofill(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (element.disabled || element.readOnly) {
    return false;
  }

  if (!element.isConnected) {
    return false;
  }

  if (element instanceof HTMLInputElement) {
    const type = (element.type || 'text').toLowerCase();
    const disallowedTypes = new Set([
      'button',
      'checkbox',
      'file',
      'hidden',
      'image',
      'password',
      'radio',
      'reset',
      'submit',
      'range',
      'color',
      'date',
      'datetime-local',
      'month',
      'time',
      'week',
    ]);

    if (disallowedTypes.has(type)) {
      return false;
    }
  }

  return true;
}

function evaluateElementForField(
  config: FieldDefinition,
  element: HTMLInputElement | HTMLTextAreaElement,
  hintText: string,
): FieldMatchEvaluation {
  const keywords = config.keywords;
  let score = 0;
  let matchedKeyword = false;
  let matchedAutocomplete = false;

  keywords.forEach((keyword) => {
    if (hintText.includes(keyword)) {
      matchedKeyword = true;
      score += Math.min(48, 26 + Math.floor(keyword.length * 0.8));
    }
  });

  const autocomplete = normaliseText(element.getAttribute('autocomplete') ?? '');
  if (autocomplete) {
    if (autocomplete.includes(config.label.toLowerCase())) {
      matchedAutocomplete = true;
      score += 32;
    }
    keywords.forEach((keyword) => {
      if (autocomplete.includes(keyword)) {
        matchedAutocomplete = true;
        score += 32;
      }
    });
  }

  const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : 'textarea';
  const inputMode = normaliseText(element.getAttribute('inputmode') ?? '');
  const isTextarea = element instanceof HTMLTextAreaElement;
  let typeBoost = false;

  switch (config.inputKind) {
    case 'email':
      if (type === 'email') {
        score += 70;
        typeBoost = true;
      } else if (hintText.includes('email')) {
        matchedKeyword = true;
        score += 25;
      }
      break;
    case 'tel':
      if (type === 'tel') {
        score += 60;
        typeBoost = true;
      } else if (inputMode.includes('tel') || inputMode.includes('numeric')) {
        score += 36;
        typeBoost = true;
      } else if (type === 'text' && hintText.includes('phone')) {
        matchedKeyword = true;
        score += 24;
      }
      break;
    case 'textarea':
      if (isTextarea) {
        score += 36;
        typeBoost = true;
      }
      break;
    case 'text':
    default:
      if (type === 'text') {
        score += 15;
        typeBoost = true;
      }
      break;
  }

  return {
    score,
    matchedKeyword,
    matchedAutocomplete,
    typeBoost,
  };
}

function shouldAcceptMatch(config: FieldDefinition, evaluation: FieldMatchEvaluation): boolean {
  if (evaluation.score < MIN_DETECTION_SCORE) {
    return false;
  }

  if (config.requireKeyword) {
    return evaluation.matchedKeyword || evaluation.matchedAutocomplete;
  }

  return (
    evaluation.matchedKeyword ||
    evaluation.matchedAutocomplete ||
    (evaluation.typeBoost && config.inputKind !== 'text')
  );
}

function getElementLabelText(
  element: HTMLInputElement | HTMLTextAreaElement,
  root: Document,
): string {
  if (element instanceof HTMLInputElement && element.labels) {
    const labels = Array.from(element.labels)
      .filter(label => label && label.textContent)
      .map(label => label.textContent!.trim());

    if (labels.length > 0) {
      return labels.join(' ');
    }
  }

  const parentLabel = element.closest('label');
  if (parentLabel && parentLabel.textContent) {
    return parentLabel.textContent.trim();
  }

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElements = labelledBy
      .split(/\s+/)
      .map(id => root.getElementById(id))
      .filter(element => element && element.textContent)
      .map(element => element!.textContent!.trim());

    if (labelElements.length > 0) {
      return labelElements.join(' ');
    }
  }

  return '';
}

function collectElementHints(
  element: HTMLInputElement | HTMLTextAreaElement,
  root: Document,
): string {
  const hints: string[] = [];

  if (element.name) {
    hints.push(element.name);
  }
  if (element.id) {
    hints.push(element.id);
  }

  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    hints.push(placeholder);
  }

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    hints.push(ariaLabel);
  }

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    labelledBy
      .split(/\s+/)
      .map((id) => root.getElementById(id))
      .filter(Boolean)
      .forEach((target) => {
        if (target?.textContent) {
          hints.push(target.textContent);
        }
      });
  }

  if (element.dataset) {
    Object.values(element.dataset).forEach((value) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        hints.push(value);
      }
    });
  }

  if (element instanceof HTMLInputElement && element.labels) {
    element.labels.forEach((label) => {
      if (label && label.textContent) {
        hints.push(label.textContent);
      }
    });
  }

  if (hints.length === 0) {
    const parentLabel = element.closest('label');
    if (parentLabel && parentLabel.textContent) {
      hints.push(parentLabel.textContent);
    }
  }

  const text = normaliseText(
    hints
      .join(' ')
      .replace(/[_:]+/g, ' ')
      .replace(/\s+/g, ' '),
  );

  return text;
}

export function filterDetectionsByElement(
  detections: DetectionMap,
  element: HTMLInputElement | HTMLTextAreaElement,
): FieldKey | null {
  let foundKey: FieldKey | null = null;
  getFieldConfigKeysSync().forEach((key) => {
    const matches = detections[key];
    if (matches.some((match) => match.element === element)) {
      foundKey = key;
    }
  });
  return foundKey;
}
