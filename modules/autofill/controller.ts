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
import { fetchProfileTemplate } from './api';
import type { AutoFillState, DetectionMap } from './types';
import type { FieldKey } from './keys';

const AGENT_FILL_EVENT = 'smart-autofill:agent-fill';
const AGENT_SUMMARY_REQUEST = 'smart-autofill:summary-request';

type RuntimeMessageHandler = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => void | boolean;

type RuntimeMessageEvents = {
  addListener: (callback: RuntimeMessageHandler) => void;
  removeListener: (callback: RuntimeMessageHandler) => void;
};

type RuntimeApi = {
  onMessage?: RuntimeMessageEvents;
};

function getExtensionRuntime(): RuntimeApi | null {
  const globalObj = globalThis as unknown as {
    browser?: { runtime?: RuntimeApi };
    chrome?: { runtime?: RuntimeApi };
  };

  return globalObj.browser?.runtime ?? globalObj.chrome?.runtime ?? null;
}

export class SmartAutofillController {
  private state: AutoFillState = getDefaultState();
  private detections: DetectionMap = createEmptyDetectionMap();
  private panel: PanelMount | null = null;
  private mutationObserver: MutationObserver | null = null;
  private scanTimeout: number | null = null;
  private persistTimeout: number | null = null;
  private unsubscribeStorage: (() => void) | null = null;
  private unsubscribeMessages: (() => void) | null = null;
  private unsubscribeCommands: (() => void) | null = null;
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
    this.listenToAgentCommands();
  }

  private runDetection(forceFill: boolean): void {
    this.detections = detectFormFields(this.doc);
    if (!this.panel) {
      this.panel = ensurePanelMount(this.state.panelOpen);
    }
    this.renderPanel();
    if (forceFill) {
      this.applyAutofill(true);
    }
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

  private listenToAgentCommands(): void {
    if (this.unsubscribeCommands) {
      return;
    }

    const runtime = getExtensionRuntime();
    const events = runtime?.onMessage;
    if (!events) {
      return;
    }

    const handler: RuntimeMessageHandler = (message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') {
        return;
      }

      const payload = message as {
        type?: string;
        profile?: Partial<Record<string, unknown>>;
        force?: boolean;
      };

      if (payload.type === AGENT_SUMMARY_REQUEST) {
        sendResponse(this.getDetectionSummaryForAgent());
        return;
      }

      if (payload.type !== AGENT_FILL_EVENT) {
        return;
      }

      void this.handleAgentFill(payload.profile, payload.force !== false);
    };

    events.addListener(handler);
    this.unsubscribeCommands = () => {
      try {
        events.removeListener(handler);
      } catch {
        // ignore unsubscribe errors
      }
    };
  }

  private async handleAgentFill(
    profilePayload: Partial<Record<string, unknown>> | undefined,
    force: boolean,
  ): Promise<void> {
    const keys = getFieldKeys();

    const normalizedFromPayload: Partial<Record<FieldKey, string>> = {};
    if (profilePayload) {
      keys.forEach((key) => {
        const value = profilePayload[key];
        if (typeof value === 'string') {
          normalizedFromPayload[key] = value;
        } else if (value != null) {
          normalizedFromPayload[key] = String(value);
        }
      });
    }

    let resolvedProfile = normalizedFromPayload;
    if (Object.keys(resolvedProfile).length === 0) {
      try {
        resolvedProfile = await fetchProfileTemplate();
      } catch (error) {
        console.warn('Smart Autofill: gagal mengambil data profil dari layanan', error);
        resolvedProfile = {};
      }
    }

    if (Object.keys(resolvedProfile).length === 0) {
      console.warn('Smart Autofill: tidak ada data profil untuk diisi dari agent');
      return;
    }

    const nextProfile = { ...this.state.profile };
    keys.forEach((key) => {
      const value = resolvedProfile[key];
      if (typeof value !== 'string') {
        return;
      }

      const trimmed = value.trim();
      nextProfile[key] = {
        ...nextProfile[key],
        value,
        enabled: trimmed.length > 0 ? true : nextProfile[key].enabled,
      };
    });

    this.state = {
      ...this.state,
      profile: nextProfile,
    };

    this.queuePersist(0);
    this.runDetection(force);
  }

  private getDetectionSummaryForAgent(): AgentDetectionSummary {
    const keys = getFieldKeys();
    let totalMatches = 0;

    const fields: AgentDetectionFieldSummary[] = keys
      .map((key) => {
        const matches = this.detections[key] ?? [];
        const matchCount = matches.length;
        if (matchCount > 0) {
          totalMatches += matchCount;
        }

        return {
          key,
          label: this.state.profile[key]?.label ?? key,
          matchCount,
          enabled: this.state.profile[key]?.enabled ?? false,
        };
      })
      .filter((field) => field.matchCount > 0);

    return {
      readyFieldCount: fields.length,
      totalMatches,
      fields,
    };
  }
}
type AgentDetectionFieldSummary = {
  key: FieldKey;
  label: string;
  matchCount: number;
  enabled: boolean;
};

type AgentDetectionSummary = {
  readyFieldCount: number;
  totalMatches: number;
  fields: AgentDetectionFieldSummary[];
};
