import type { AutoFillState, DetectionMap } from './types';
import type { FieldKey } from './keys';
import { getFieldKeys } from './state';
import { escapeHtml } from './utils';
import panelStyles from './panel-style.ts';

export interface PanelMount {
  host: HTMLDivElement;
  wrapper: HTMLDivElement;
  shadowRoot: ShadowRoot;
}

export interface PanelHandlers {
  onToggle: (key: FieldKey, enabled: boolean) => void;
  onValueChange: (key: FieldKey, value: string) => void;
  onApply: () => void;
  onPanelToggle: () => void;
}

export interface RenderPanelParams {
  mount: PanelMount;
  state: AutoFillState;
  detections: DetectionMap;
  summaryText: string;
  handlers: PanelHandlers;
}

export function ensurePanelMount(open: boolean): PanelMount {
  const existing = document.getElementById('smart-autofill-root') as HTMLDivElement | null;
  if (existing && existing.shadowRoot) {
    const wrapper = existing.shadowRoot.querySelector('.saf-wrapper') as HTMLDivElement | null;
    if (wrapper) {
      wrapper.dataset.open = open ? 'true' : 'false';
      return {
        host: existing,
        wrapper,
        shadowRoot: existing.shadowRoot,
      };
    }
  }

  const host = document.createElement('div');
  host.id = 'smart-autofill-root';
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
    width: '0',
    height: '0',
  });

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = panelStyles;

  const wrapper = document.createElement('div');
  wrapper.className = 'saf-wrapper';
  wrapper.dataset.open = open ? 'true' : 'false';

  shadowRoot.append(style, wrapper);

  const mountTarget = document.body ?? document.documentElement;
  mountTarget.append(host);

  return {
    host,
    wrapper,
    shadowRoot,
  };
}

export function renderPanel(params: RenderPanelParams): void {
  const { mount, state, detections, summaryText, handlers } = params;
  const { wrapper } = mount;

  wrapper.dataset.open = state.panelOpen ? 'true' : 'false';

  const fieldsMarkup = getFieldKeys()
    .map((key) => {
      const field = state.profile[key];
      const detected = detections[key] ?? [];
      const ready = detected.length > 0;
      const badgeClass = ready ? 'saf-badge saf-badge--ready' : 'saf-badge saf-badge--missing';
      const badgeLabel = ready ? 'Siap diisi' : 'Menunggu field';
      const helperText = ready
        ? `Terhubung ke ${detected.length} field pada halaman ini.`
        : field.description;
      const disabledAttr = field.enabled ? '' : 'disabled';
      const escapedLabel = escapeHtml(field.label);
      const escapedPlaceholder = escapeHtml(field.placeholder);
      const escapedHelper = escapeHtml(helperText);

      if (field.inputKind === 'textarea') {
        return `
          <div class="saf-field" data-key="${key}" data-ready="${ready}">
            <div class="saf-field-header">
              <div class="saf-field-heading">
                <span class="saf-field-label">${escapedLabel}</span>
                <span class="${badgeClass}">${badgeLabel}</span>
              </div>
              <label class="saf-switch">
                <input type="checkbox" data-role="toggle" data-key="${key}" ${field.enabled ? 'checked' : ''}/>
                <span class="saf-slider"></span>
              </label>
            </div>
            <textarea
              class="saf-input saf-input--multiline"
              data-role="value"
              data-key="${key}"
              placeholder="${escapedPlaceholder}"
              ${disabledAttr}
            >${escapeHtml(field.value)}</textarea>
            <p class="saf-helper">${escapedHelper}</p>
          </div>
        `;
      }

      const typeAttr = field.inputKind === 'text' ? 'text' : field.inputKind;

      return `
        <div class="saf-field" data-key="${key}" data-ready="${ready}">
          <div class="saf-field-header">
            <div class="saf-field-heading">
              <span class="saf-field-label">${escapedLabel}</span>
              <span class="${badgeClass}">${badgeLabel}</span>
            </div>
            <label class="saf-switch">
              <input type="checkbox" data-role="toggle" data-key="${key}" ${field.enabled ? 'checked' : ''}/>
              <span class="saf-slider"></span>
            </label>
          </div>
          <input
            class="saf-input"
            type="${typeAttr}"
            data-role="value"
            data-key="${key}"
            value="${escapeHtml(field.value)}"
            placeholder="${escapedPlaceholder}"
            ${disabledAttr}
          />
          <p class="saf-helper">${escapedHelper}</p>
        </div>
      `;
    })
    .join('');

  const panelMarkup = `
    <div class="saf-panel">
      <button class="saf-toggle-handle" type="button" data-role="panel-toggle" data-open="${
        state.panelOpen ? 'true' : 'false'
      }">${state.panelOpen ? '&lt;&lt;' : '&gt;&gt;'}</button>
      <div class="saf-header">
        <div class="saf-title-group">
          <span class="saf-title">Smart Autofill</span>
          <span class="saf-subtitle">${escapeHtml(summaryText)}</span>
        </div>
        <span class="saf-chip">Auto fill</span>
      </div>
      <div class="saf-body">
        ${fieldsMarkup}
        <button class="saf-apply" type="button" data-role="apply" data-label="Isi otomatis sekarang">Isi otomatis sekarang</button>
      </div>
      <div class="saf-footer">
        <p class="saf-tip">
          Edit nilai default sesuai kebutuhan. Gunakan toggle untuk menentukan field mana yang diisi otomatis.
        </p>
      </div>
    </div>
  `;

  wrapper.innerHTML = panelMarkup;

  attachEventHandlers(wrapper, handlers);
}

function attachEventHandlers(container: HTMLDivElement, handlers: PanelHandlers): void {
  const toggleInputs = Array.from(
    container.querySelectorAll<HTMLInputElement>('input[data-role="toggle"]'),
  );
  const valueInputs = Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-role="value"]'),
  );
  const applyButton = container.querySelector<HTMLButtonElement>('button[data-role="apply"]');
  const panelToggle = container.querySelector<HTMLButtonElement>('button[data-role="panel-toggle"]');

  toggleInputs.forEach((toggle) => {
    toggle.addEventListener('change', () => {
      const key = (toggle.dataset.key ?? '') as FieldKey;
      handlers.onToggle(key, toggle.checked);
    });
  });

  valueInputs.forEach((input) => {
    input.addEventListener('input', () => {
      const key = (input.dataset.key ?? '') as FieldKey;
      handlers.onValueChange(key, input.value);
    });
  });

  applyButton?.addEventListener('click', (event) => {
    event.preventDefault();
    handlers.onApply();
    animateApplyButton(applyButton);
  });

  panelToggle?.addEventListener('click', (event) => {
    event.preventDefault();
    handlers.onPanelToggle();
  });
}

function animateApplyButton(button: HTMLButtonElement): void {
  const originalLabel = button.dataset.label ?? button.textContent ?? '';
  button.dataset.state = 'success';
  button.textContent = 'Terisi!';

  window.setTimeout(() => {
    button.dataset.state = '';
    button.textContent = originalLabel;
  }, 1200);
}
