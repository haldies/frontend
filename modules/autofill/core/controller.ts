import { detectFormFields } from './detection';
import { applyValueToElement } from '../utils/utils';
import { countReadyMatches, createEmptyDetectionMap, getDefaultState, getFieldKeys } from '../storage/state';
import {
  loadStateFromStorage,
  saveStateToStorage,
  subscribeToStateChanges,
  subscribeToStateMessages,
} from '../storage/storage';
import { fetchProfileTemplate } from '../api/api';
import { ensureFieldConfigsReady, subscribeToFieldConfigChanges, setupIndexedDbChangeListener, getFieldConfigsSync, getFieldConfigKeysSync } from './config';
import type { AutoFillState, DetectionMap } from '../types/types';
import type { FieldKey } from '../types/keys';

const AGENT_FILL_EVENT = 'smart-autofill:agent-fill';
const AGENT_SUMMARY_REQUEST = 'smart-autofill:summary-request';
const SIDEPANEL_TRIGGER_DETECTION = 'smart-autofill:sidepanel-trigger-detection';

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
  private mutationObserver: MutationObserver | null = null;
  private scanTimeout: number | null = null;
  private persistTimeout: number | null = null;
  private unsubscribeStorage: (() => void) | null = null;
  private unsubscribeMessages: (() => void) | null = null;
  private unsubscribeCommands: (() => void) | null = null;
  private unsubscribeFieldConfigs: (() => void) | null = null;
  private readonly doc: Document;

  constructor(doc: Document = document) {
    this.doc = doc;
  }

  public async start(): Promise<void> {
    console.log('Starting Smart Autofill Controller...');
    this.state = await loadStateFromStorage();
    console.log('Loaded state from storage:', this.state);

    this.runDetection(false);
    this.observeDomChanges();
    this.listenToSharedState();
    this.listenToAgentCommands();

    // Set up field config change listener for auto-redetection
    console.log('🔄 Setting up field config change listener for auto-redetection...');
    this.listenToFieldConfigChanges();
  }

  private runDetection(forceFill: boolean): void {
    console.log('Running detection...');
    this.detections = detectFormFields(this.doc);
    console.log('Detected fields:', this.detections);

    if (forceFill) {
      console.log('Force filling autofill...');
      this.applyAutofill(true);
    }
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
      console.log('📨 Received message:', message);
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

      if (payload.type === SIDEPANEL_TRIGGER_DETECTION) {
        console.log('🔄 Received sidepanel trigger detection request');
        void this.handleSidepanelDetectionRequest();
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

  public async enableCustomFieldsSupport(): Promise<void> {
    console.log('🚀 Enabling custom fields support...');

    try {
      console.log('ℹ️ IndexedDB support has been disabled');
      setupIndexedDbChangeListener();

      console.log('📞 Calling ensureFieldConfigsReady()...');
      await ensureFieldConfigsReady();
      console.log('✅ ensureFieldConfigsReady() completed');

      console.log('📞 Setting up field config change listener...');
      this.listenToFieldConfigChanges();
      console.log('✅ Field config change listener setup completed');

      // Run detection immediately after enabling custom fields support
      console.log('🔍 Running detection with default field configurations...');
      this.runDetection(false);
      console.log('✅ Detection completed');

      console.log('🎉 Field configurations ready and detection completed');
    } catch (error) {
      console.error('❌ Error in enableCustomFieldsSupport():', error);
      throw error;
    }
  }

  public triggerDetection(): void {
    console.log('🔍 Manual detection triggered...');
    console.log('📋 Current field configs:', getFieldConfigsSync());
    console.log('🔑 Available field keys:', getFieldConfigKeysSync());
    this.runDetection(false);
  }

  private listenToFieldConfigChanges(): void {
    console.log('Listening to field config changes...');
    if (this.unsubscribeFieldConfigs) {
      return;
    }

    this.unsubscribeFieldConfigs = subscribeToFieldConfigChanges(({ configs, keys }) => {
      console.log('Field configs changed, re-running detection...');
      console.log('New configs:', configs);
      console.log('New keys:', keys);

      // Re-run detection with updated field configurations
      this.runDetection(false);
    });
  }

  public async handleSidepanelDetectionRequest(): Promise<void> {
    console.log('🚀 Handling sidepanel detection request...');

    try {
      // Set up listeners if not already set up
      if (!this.unsubscribeFieldConfigs) {
        console.log('🔄 Setting up listeners for first time...');
        setupIndexedDbChangeListener();
        this.listenToFieldConfigChanges();
      }

      // Load field configurations when requested
      console.log('🔄 Loading field configurations...');
      await ensureFieldConfigsReady();

      console.log('🔍 Running detection with field configurations...');
      this.triggerDetection();
    } catch (error) {
      console.error('❌ Error handling sidepanel detection request:', error);
    }
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

// Global controller instance for external access
let globalController: SmartAutofillController | null = null;

export function getGlobalController(): SmartAutofillController | null {
  return globalController;
}

export function setGlobalController(controller: SmartAutofillController): void {
  globalController = controller;
}
