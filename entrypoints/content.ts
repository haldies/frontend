import { SmartAutofillController, setGlobalController } from '../modules/autofill';

const SIDEPANEL_TRIGGER_DETECTION = 'smart-autofill:sidepanel-trigger-detection';
const CONFIG_REFRESH_REQUEST = 'smart-autofill:refresh-config';
const SCAN_FORMS_REQUEST = 'SCAN_FORMS';

type ChromeGlobal = typeof globalThis & { chrome?: any };
const chromeApi = (globalThis as ChromeGlobal).chrome;

function getElementLabelText(element: HTMLInputElement | HTMLTextAreaElement): string {
  // Try element.labels first
  if (element instanceof HTMLInputElement && element.labels && element.labels.length > 0) {
    const labels = Array.from(element.labels)
      .filter(label => label && label.textContent)
      .map(label => label.textContent!.trim());
    if (labels.length > 0) return labels.join(' ');
  }

  // Try closest label
  const parentLabel = element.closest('label');
  if (parentLabel?.textContent) {
    return parentLabel.textContent.trim();
  }

  // Try aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElements = labelledBy
      .split(/\s+/)
      .map(id => document.getElementById(id))
      .filter(el => el && el.textContent)
      .map(el => el!.textContent!.trim());
    if (labelElements.length > 0) return labelElements.join(' ');
  }

  // Try aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // Try placeholder as last resort
  if (element.placeholder) return element.placeholder.trim();

  return '';
}

function collectElementHints(element: HTMLInputElement | HTMLTextAreaElement): string {
  const hints: string[] = [];
  if (element.name) hints.push(element.name);
  if (element.id) hints.push(element.id);
  if (element.placeholder) hints.push(element.placeholder);
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) hints.push(ariaLabel);
  return hints.join(' ').toLowerCase().replace(/[_:]+/g, ' ').replace(/\s+/g, ' ').trim();
}

declare global {
  interface Window {
    __smartAutofillController__?: SmartAutofillController;
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],

  main() {
    console.log('🚀 Content script starting...');

    if (window.top && window !== window.top) {
      console.log('📋 Content script in iframe, skipping...');
      return;
    }

    if (window.__smartAutofillController__) {
      console.log('📋 Controller already exists, skipping...');
      return;
    }

    console.log('🎯 Creating new SmartAutofillController...');
    const controller = new SmartAutofillController();
    window.__smartAutofillController__ = controller;
    setGlobalController(controller);

    console.log('🔄 Starting controller...');
    void controller.start();

    // Listen for messages from background script (sent by sidepanel)
    if (chromeApi?.runtime?.onMessage) {
      console.log('📡 Setting up message listener in content script...');

      chromeApi.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
        console.log('📨 Content script received message:', message);
        console.log('📨 Message type:', message.type);
        console.log('📨 Controller exists:', !!window.__smartAutofillController__);

        // Handle sidepanel detection request
        if (message.type === SIDEPANEL_TRIGGER_DETECTION) {
          console.log('🎯 Processing sidepanel detection request...');

          if (window.__smartAutofillController__) {
            // Trigger the handler directly
            void (window.__smartAutofillController__ as any).handleSidepanelDetectionRequest();

            setTimeout(() => {
              sendResponse({ success: true, message: 'Detection triggered' });
            }, 500);
            return true; // Keep message channel open for async response
          }
        }

        // Handle config refresh request
        if (message.type === CONFIG_REFRESH_REQUEST) {
          console.log('🔄 Processing config refresh request...');

          if (window.__smartAutofillController__) {
            // Import and use the config refresh function
            import('../modules/autofill/core/config').then(({ refreshConfigsFromApi }) => {
              refreshConfigsFromApi()
                .then(() => {
                  console.log('✅ Config refresh completed');
                  sendResponse({ success: true, message: 'Config refreshed successfully' });
                })
                .catch((error) => {
                  console.error('❌ Config refresh failed:', error);
                  sendResponse({ success: false, message: 'Config refresh failed', error: error.message });
                });
            }).catch((error) => {
              console.error('❌ Failed to import config refresh function:', error);
              sendResponse({ success: false, message: 'Failed to import config refresh function' });
            });

            return true; // Keep message channel open for async response
          }
        }

        // Handle form fill request
        if (message.type === 'FILL_FORM') {
          console.log('📝 Processing form fill request...');
          
          try {
            const { formIndex, fields } = message;
            console.log('📝 Form index:', formIndex, 'Fields to fill:', fields);
            
            // Get all eligible candidates again
            const allInputs = Array.from(
              document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
            );
            
            const isEligibleForAutofill = (element: HTMLInputElement | HTMLTextAreaElement): boolean => {
              if (element.disabled || element.readOnly || !element.isConnected) return false;
              if (element instanceof HTMLInputElement) {
                const type = (element.type || 'text').toLowerCase();
                const disallowedTypes = new Set([
                  'button', 'checkbox', 'file', 'hidden', 'image', 'password',
                  'radio', 'reset', 'submit', 'range', 'color', 'date',
                  'datetime-local', 'month', 'time', 'week',
                ]);
                if (disallowedTypes.has(type)) return false;
              }
              return true;
            };
            
            const candidates = allInputs.filter(isEligibleForAutofill);
            console.log('📝 Total eligible candidates:', candidates.length);
            
            let filledCount = 0;
            fields.forEach((field: any) => {
              const elementIndex = field.index - 1; // Convert to 0-based index
              if (elementIndex >= 0 && elementIndex < candidates.length) {
                const element = candidates[elementIndex];
                element.value = field.value;
                
                // Trigger events to ensure form validation works
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                
                console.log(`✅ Filled field ${field.index}:`, field.value);
                filledCount++;
              }
            });
            
            console.log(`✅ Form fill completed: ${filledCount}/${fields.length} fields filled`);
            sendResponse({ success: true, filledCount });
          } catch (error) {
            console.error('❌ Form fill failed:', error);
            sendResponse({ success: false, error: String(error) });
          }
          
          return true;
        }

        // Handle form scanning request
        if (message.type === SCAN_FORMS_REQUEST) {
          console.log('🔍 Processing form scan request...');

          import('../modules/autofill/core/detection').then(({ detectFormFields }) => {
            import('../modules/autofill/core/config').then(({ getFieldConfigsSync }) => {
              const detectionMap = detectFormFields(document);
              const configs = getFieldConfigsSync();
              
              // Helper function to check if element is eligible (same as detection.ts)
              const isEligibleForAutofill = (element: HTMLInputElement | HTMLTextAreaElement): boolean => {
                if (element.disabled || element.readOnly || !element.isConnected) return false;
                
                if (element instanceof HTMLInputElement) {
                  const type = (element.type || 'text').toLowerCase();
                  const disallowedTypes = new Set([
                    'button', 'checkbox', 'file', 'hidden', 'image', 'password',
                    'radio', 'reset', 'submit', 'range', 'color', 'date',
                    'datetime-local', 'month', 'time', 'week',
                  ]);
                  if (disallowedTypes.has(type)) return false;
                }
                
                return true;
              };

              // Group fields by forms - use same filtering as detection
              const formsMap = new Map<HTMLFormElement | null, any[]>();
              const allInputs = Array.from(
                document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
              );
              
              console.log('🔍 Total inputs found:', allInputs.length);
              
              const candidates = allInputs.filter(el => {
                const eligible = isEligibleForAutofill(el);
                if (!eligible && el instanceof HTMLInputElement) {
                  console.log('❌ Filtered out:', el.type, el.name || el.id || 'no-name');
                }
                return eligible;
              });
              
              console.log('✅ Eligible candidates:', candidates.length);

              candidates.forEach((element) => {
                // Double-check: skip hidden fields
                if (element instanceof HTMLInputElement && element.type === 'hidden') {
                  console.log('⚠️ Hidden field slipped through, skipping:', element.name);
                  return;
                }
                
                const form = element.closest('form') as HTMLFormElement | null;
                if (!formsMap.has(form)) {
                  formsMap.set(form, []);
                }
                
                const elementType = element instanceof HTMLInputElement ? element.type : 'textarea';
                const labelText = getElementLabelText(element);
                console.log('➕ Adding field:', elementType, 'label:', labelText || '(no label)', 'name:', element.name, 'id:', element.id);
                
                // Find if this element was detected
                let detectedAs = '';
                let score = 0;
                Object.entries(detectionMap).forEach(([key, matches]: [string, any]) => {
                  const match = matches.find((m: any) => m.element === element);
                  if (match) {
                    detectedAs = configs[key as any]?.label || key;
                    score = match.score;
                  }
                });

                formsMap.get(form)!.push({
                  index: formsMap.get(form)!.length + 1,
                  type: elementType,
                  id: element.id || '',
                  name: element.name || '',
                  placeholder: element.placeholder || '',
                  labelText: getElementLabelText(element),
                  hints: collectElementHints(element),
                  isRequired: element.hasAttribute('required'),
                  autocomplete: element.getAttribute('autocomplete') || '',
                  detectedAs,
                  score,
                });
              });

              // Convert to array format
              const forms = Array.from(formsMap.entries()).map(([form, fields]) => ({
                id: form?.id || form?.className || 'Tanpa Form Element',
                action: form?.action || '',
                method: form?.method || 'get',
                fieldCount: fields.length,
                fields,
              }));

              console.log('📋 Scanned forms for sidepanel:', forms);
              console.log('📊 Total eligible candidates:', candidates.length);
              console.log('📊 Total forms:', forms.length);
              forms.forEach((form, idx) => {
                console.log(`📄 Form ${idx + 1}: ${form.id} - ${form.fieldCount} fields`);
              });
              
              sendResponse({ success: true, forms });
            }).catch((error) => {
              console.error('❌ Failed to get field configs:', error);
              sendResponse({ success: false, message: 'Failed to get field configs' });
            });
          }).catch((error) => {
            console.error('❌ Failed to import detection module:', error);
            sendResponse({ success: false, message: 'Failed to import detection module' });
          });

          return true; // Keep message channel open for async response
        }

        sendResponse({ success: false, message: 'Unknown message type or no controller' });
        return true;
      });

      console.log('✅ Message listener setup completed');
    } else {
      console.warn('⚠️ Chrome runtime not available for messaging');
    }

    console.log('✅ Content script initialization completed');
  },
});
