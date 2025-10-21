import type { FieldKey } from '@/modules/autofill/keys';
import { getApiBaseUrl } from '@/modules/autofill/api';

export type AgentAction = 'idle' | 'fill_forms';

export interface AgentMessageInput {
  role: 'assistant' | 'user' | 'system';
  content: string;
}

export interface AgentContextInput {
  filledCount: number;
  totalFields: number;
  highlightKeys: FieldKey[];
}

export interface AgentResponsePayload {
  reply: string;
  action: AgentAction;
  profile?: Partial<Record<FieldKey, string>>;
}

export interface DetectionFieldSummary {
  key: FieldKey;
  label: string;
  matchCount: number;
  enabled: boolean;
}

export interface DetectionSummaryPayload {
  readyFieldCount: number;
  totalMatches: number;
  fields: DetectionFieldSummary[];
}

const SUMMARY_REQUEST_EVENT = 'smart-autofill:summary-request';
const FILL_EVENT = 'smart-autofill:agent-fill';

type TabQueryInfo = {
  active: boolean;
  lastFocusedWindow: boolean;
};

type ExtensionTab = {
  id?: number;
};

type TabsApi = {
  query?: (
    queryInfo: TabQueryInfo,
    callback?: (tabs: ExtensionTab[]) => void,
  ) => Promise<ExtensionTab[]> | void;
  sendMessage?: (
    tabId: number,
    message: unknown,
    options?: unknown,
    callback?: (response?: unknown) => void,
  ) => Promise<unknown> | void;
};

function getTabsApi(): TabsApi | null {
  const globalObj = globalThis as unknown as {
    browser?: { tabs?: TabsApi };
    chrome?: { tabs?: TabsApi };
  };

  return globalObj.browser?.tabs ?? globalObj.chrome?.tabs ?? null;
}

async function queryActiveTabs(): Promise<ExtensionTab[]> {
  const tabsApi = getTabsApi();
  if (!tabsApi?.query) {
    return [];
  }

  const maybePromise = tabsApi.query({ active: true, lastFocusedWindow: true });
  if (maybePromise && typeof (maybePromise as Promise<ExtensionTab[]>).then === 'function') {
    return await (maybePromise as Promise<ExtensionTab[]>);
  }

  return await new Promise<ExtensionTab[]>((resolve, reject) => {
    tabsApi.query?.({ active: true, lastFocusedWindow: true }, (tabs) => {
      const runtimeError =
        (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome
          ?.runtime?.lastError;
      if (runtimeError?.message) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(tabs ?? []);
    });
  });
}

async function getActiveTabId(): Promise<number | null> {
  const tabs = await queryActiveTabs();
  const active = tabs.find((tab) => typeof tab.id === 'number');
  return active?.id ?? null;
}

async function sendMessageToActiveTab(message: unknown): Promise<unknown> {
  const tabsApi = getTabsApi();
  if (!tabsApi?.sendMessage) {
    throw new Error('Tabs messaging tidak tersedia.');
  }

  const tabId = await getActiveTabId();
  if (tabId == null) {
    throw new Error('Tidak ada tab aktif yang dapat dihubungi.');
  }

  const maybePromise = tabsApi.sendMessage(tabId, message);
  if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
    return await (maybePromise as Promise<unknown>);
  }

  return await new Promise<unknown>((resolve, reject) => {
    tabsApi.sendMessage?.(tabId, message, undefined, (response) => {
      const runtimeError =
        (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome
          ?.runtime?.lastError;
      if (runtimeError?.message) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(response);
    });
  });
}

export async function requestAgentResponse(
  messages: AgentMessageInput[],
  context: AgentContextInput,
): Promise<AgentResponsePayload> {
  const endpoint = `${getApiBaseUrl()}/api/agent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      context: {
        filled_count: context.filledCount,
        total_fields: context.totalFields,
        highlight_keys: context.highlightKeys,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    reply?: string;
    action?: AgentAction;
    profile?: Partial<Record<FieldKey, string>>;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error(payload?.detail || 'Agent gagal merespons.');
  }

  if (!payload || typeof payload.reply !== 'string' || typeof payload.action !== 'string') {
    throw new Error('Respons agent tidak valid.');
  }

  return {
    reply: payload.reply,
    action: payload.action as AgentAction,
    profile: payload.profile,
  };
}

export async function fetchDetectionSummary(): Promise<DetectionSummaryPayload | null> {
  try {
    const response = (await sendMessageToActiveTab({ type: SUMMARY_REQUEST_EVENT })) as
      | DetectionSummaryPayload
      | null
      | undefined;
    return response ?? null;
  } catch (error) {
    console.warn('Smart Autofill agent: gagal mengambil ringkasan deteksi', error);
    return null;
  }
}

export async function dispatchFillCommand(
  profile: Partial<Record<FieldKey, string>> | undefined,
  force = true,
): Promise<void> {
  await sendMessageToActiveTab({
    type: FILL_EVENT,
    profile,
    force,
  });
}
