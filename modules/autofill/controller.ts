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
    console.log('Starting Smart Autofill Controller...');
    this.state = await loadStateFromStorage();
    console.log('Loaded state from storage:', this.state);
    
    this.panel = ensurePanelMount(this.state.panelOpen);
    this.runDetection(false);
    this.observeDomChanges();
    this.listenToSharedState();
    this.listenToAgentCommands();
  }

  private runDetection(forceFill: boolean): void {
    console.log('Running detection...');
    this.detections = detectFormFields(this.doc);
    console.log('Detected fields:', this.detections);

    if (!this.panel) {
      this.panel = ensurePanelMount(this.state.panelOpen);
    }

    this.renderPanel();

    if (forceFill) {
      console.log('Force filling autofill...');
      this.applyAutofill(true);
    }
  }

  private renderPanel(): void {
    if (!this.panel) {
      console.log('No panel to render.');
      return;
    }

    const readyCount = countReadyMatches(this.detections);
    const total = getFieldKeys().length;
    const summaryText =
      readyCount > 0
        ? `${readyCount} dari ${total} field cocok dan siap diisi otomatis.`
        : 'Belum ada field yang cocok. Coba fokus pada form yang ingin diisi.';

    console.log('Rendering panel with summary text:', summaryText);

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

    console.log('Observing DOM changes...');
    this.mutationObserver = new MutationObserver(() => {
      if (this.scanTimeout !== null) {
        window.clearTimeout(this.scanTimeout);
      }
      this.scanTimeout = window.setTimeout(() => {
        this.scanTimeout = null;
        console.log('DOM changed, re-running detection...');
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
    console.log(`Toggling field ${key} to ${enabled ? 'enabled' : 'disabled'}`);
    if (!this.state.profile[key]) {
      return;
    }
    this.state.profile[key].enabled = enabled;
    this.queuePersist(0);
    this.applyAutofill(false);
    this.renderPanel();
  };

  private handleValueChange = (key: FieldKey, value: string): void => {
    console.log(`Changing value for field ${key} to: ${value}`);
    if (!this.state.profile[key]) {
      return;
    }
    this.state.profile[key].value = value;
    this.queuePersist();
  };

  private handleApply = (): void => {
    console.log('Applying autofill...');
    this.applyAutofill(true);
  };

  private handlePanelToggle = (): void => {
    console.log('Toggling panel visibility');
    this.state.panelOpen = !this.state.panelOpen;
    if (this.panel) {
      this.panel.wrapper.dataset.open = this.state.panelOpen ? 'true' : 'false';
    }
    this.queuePersist(0);
  };

  private applyAutofill(force: boolean): void {
    console.log('Applying autofill for fields...');
    getFieldKeys().forEach((key) => {
      const profileField = this.state.profile[key];
      if (!profileField?.enabled) {
        return;
      }

      const matches = this.detections[key] ?? [];
      matches.forEach((match) => {
        console.log(`Filling field ${key} with value: ${profileField.value}`);
        applyValueToElement(match.element, profileField.value, force);
      });
    });
  }

  private queuePersist(delay = 220): void {
    console.log('Queueing state persist...');
    if (this.persistTimeout !== null) {
      window.clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = window.setTimeout(() => {
      this.persistTimeout = null;
      console.log('Persisting state to storage:', this.state);
      void saveStateToStorage({
        ...this.state,
        profile: { ...this.state.profile },
      });
    }, delay);
  }

  private listenToSharedState(): void {
    console.log('Listening to shared state changes...');
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
    console.log('Applying shared state:', nextState);
    this.state = nextState;
    this.renderPanel();
    this.applyAutofill(false);
  }

  private listenToAgentCommands(): void {
    console.log('Listening to agent commands...');
    if (this.unsubscribeCommands) {
      return;
    }

    const runtime = getExtensionRuntime();
    const events = runtime?.onMessage;
    if (!events) {
      return;
    }

    const handler: RuntimeMessageHandler = (message, _sender, sendResponse) => {
      console.log('Received message from agent:', message);
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
      }
    };
  }

  private async handleAgentFill(
    profilePayload: Partial<Record<string, unknown>> | undefined,
    force: boolean,
  ): Promise<void> {
    console.log('Handling agent fill with profile:', profilePayload);
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
        console.warn('Failed to fetch profile data from service', error);
        resolvedProfile = {};
      }
    }

    if (Object.keys(resolvedProfile).length === 0) {
      console.warn('No profile data to fill from agent');
      return;
    }

    console.log('Resolved profile for autofill:', resolvedProfile);

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
    console.log('Getting detection summary for agent...');
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
