import { detectFormFields } from './detection';
import { ensurePanelMount, renderPanel, type PanelMount } from './ui';
import { applyValueToElement } from './utils';
import { countReadyMatches, createEmptyDetectionMap, getDefaultState, getFieldKeys } from './state';
import {
  loadStateFromStorage,
  saveStateToStorage,
  subscribeToStateChanges,
  subscribeToStateMessages,
} from './storage';
import type { AutoFillState, DetectionMap } from './types';
import type { FieldKey } from './keys';

export class SmartAutofillController {
  private state: AutoFillState = getDefaultState();
  private detections: DetectionMap = createEmptyDetectionMap();
  private panel: PanelMount | null = null;
  private mutationObserver: MutationObserver | null = null;
  private scanTimeout: number | null = null;
  private persistTimeout: number | null = null;
  private unsubscribeStorage: (() => void) | null = null;
  private unsubscribeMessages: (() => void) | null = null;
  private readonly doc: Document;

  constructor(doc: Document = document) {
    this.doc = doc;
  }

  public async start(): Promise<void> {
    this.state = await loadStateFromStorage();
    this.panel = ensurePanelMount(this.state.panelOpen);
    this.runDetection(false);
    this.observeDomChanges();
    this.listenToSharedState();
  }

  private runDetection(forceFill: boolean): void {
    this.detections = detectFormFields(this.doc);
    if (!this.panel) {
      this.panel = ensurePanelMount(this.state.panelOpen);
    }
    this.renderPanel();
    this.applyAutofill(forceFill);
  }

  private renderPanel(): void {
    if (!this.panel) {
      return;
    }

    const readyCount = countReadyMatches(this.detections);
    const total = getFieldKeys().length;
    const summaryText =
      readyCount > 0
        ? `${readyCount} dari ${total} field cocok dan siap diisi otomatis.`
        : 'Belum ada field yang cocok. Coba fokus pada form yang ingin diisi.';

    renderPanel({
      mount: this.panel,
      state: this.state,
      detections: this.detections,
      summaryText,
      handlers: {
        onToggle: this.handleToggle,
        onValueChange: this.handleValueChange,
        onApply: this.handleApply,
        onPanelToggle: this.handlePanelToggle,
      },
    });
  }

  private observeDomChanges(): void {
    if (this.mutationObserver) {
      return;
    }

    this.mutationObserver = new MutationObserver(() => {
      if (this.scanTimeout !== null) {
        window.clearTimeout(this.scanTimeout);
      }
      this.scanTimeout = window.setTimeout(() => {
        this.scanTimeout = null;
        this.runDetection(false);
      }, 150);
    });

    this.mutationObserver.observe(this.doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  private handleToggle = (key: FieldKey, enabled: boolean): void => {
    if (!this.state.profile[key]) {
      return;
    }
    this.state.profile[key].enabled = enabled;
    this.queuePersist(0);
    this.applyAutofill(false);
    this.renderPanel();
  };

  private handleValueChange = (key: FieldKey, value: string): void => {
    if (!this.state.profile[key]) {
      return;
    }
    this.state.profile[key].value = value;
    this.queuePersist();
  };

  private handleApply = (): void => {
    this.applyAutofill(true);
  };

  private handlePanelToggle = (): void => {
    this.state.panelOpen = !this.state.panelOpen;
    if (this.panel) {
      this.panel.wrapper.dataset.open = this.state.panelOpen ? 'true' : 'false';
    }
    this.queuePersist(0);
  };

  private applyAutofill(force: boolean): void {
    getFieldKeys().forEach((key) => {
      const profileField = this.state.profile[key];
      if (!profileField?.enabled) {
        return;
      }

      const matches = this.detections[key] ?? [];
      matches.forEach((match) => {
        applyValueToElement(match.element, profileField.value, force);
      });
    });
  }

  private queuePersist(delay = 220): void {
    if (this.persistTimeout !== null) {
      window.clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = window.setTimeout(() => {
      this.persistTimeout = null;
      void saveStateToStorage({
        ...this.state,
        profile: { ...this.state.profile },
      });
    }, delay);
  }

  private listenToSharedState(): void {
    if (!this.unsubscribeStorage) {
      this.unsubscribeStorage = subscribeToStateChanges((nextState) => {
        this.applySharedState(nextState);
      });
    }

    if (!this.unsubscribeMessages) {
      this.unsubscribeMessages = subscribeToStateMessages((nextState) => {
        this.applySharedState(nextState);
      });
    }
  }

  private applySharedState(nextState: AutoFillState): void {
    this.state = nextState;
    this.renderPanel();
    this.applyAutofill(false);
  }
}
