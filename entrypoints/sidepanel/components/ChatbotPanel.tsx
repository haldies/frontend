import { useEffect, useMemo, useRef, useState } from 'react';
import type { FieldKey } from '@/modules/autofill/keys';
import type { ProfileFieldState } from '@/modules/autofill/types';
import { Loader2, Send, Sparkles } from 'lucide-react';
import {
  dispatchFillCommand,
  fetchDetectionSummary,
  requestAgentResponse,
  type DetectionSummaryPayload,
} from '../agentClient';
import type { ExtractionStatus } from '../types';

interface ChatbotPanelProps {
  profile: Record<FieldKey, ProfileFieldState>;
  status: ExtractionStatus;
  highlightKeys: FieldKey[];
  filledCount: number;
  totalFields: number;
  onEditProfile: () => void;
}

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  createdAt: Date;
  mood?: 'typing' | 'error' | 'info';
};

function createTypingMessage(id: string, content: string, createdAt?: Date): ChatMessage {
  return {
    id,
    role: 'assistant',
    content,
    createdAt: createdAt ?? new Date(),
    mood: 'typing',
  };
}

const TypingMessage = ({ hint }: { hint: string }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-300 via-indigo-200 to-indigo-300 animate-bounce"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </div>
    <div className="h-2.5 w-32 overflow-hidden rounded-full bg-indigo-100/60">
      <div className="h-full w-full animate-pulse bg-gradient-to-r from-indigo-200 via-white to-indigo-200" />
    </div>
    <span className="text-[11px] font-medium text-indigo-400/80">{hint}</span>
  </div>
);

function createMessageId() {
  return crypto?.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const YES_KEYWORDS = ['ya', 'iya', 'oke', 'ok', 'boleh', 'lanjut', 'lanjutkan', 'gas', 'silakan', 'yuk'];
const NO_KEYWORDS = ['tidak', 'nggak', 'gak', 'ga', 'jangan', 'batal', 'nanti', 'belum'];

function matchesKeyword(prompt: string, keywords: string[]): boolean {
  const lower = prompt.toLowerCase();
  return keywords.some((keyword) => lower === keyword || lower.includes(keyword));
}

function describeDetectionSummary(summary: DetectionSummaryPayload | null): string | null {
  if (!summary) {
    return null;
  }

  if (summary.readyFieldCount === 0) {
    return 'Belum ada field pada halaman ini yang terhubung dengan Smart Autofill.';
  }

  const head = `Aku mendeteksi ${summary.readyFieldCount} field terhubung (${summary.totalMatches} elemen input).`;
  const sample = summary.fields
    .slice(0, 3)
    .map((field) => `${field.label} (${field.matchCount})`)
    .join(', ');

  if (!sample) {
    return head;
  }

  if (summary.fields.length > 3) {
    return `${head}\nContoh field: ${sample}, dan lainnya.`;
  }

  return `${head}\nContoh field: ${sample}.`;
}

export default function ChatbotPanel({
  profile: _profile,
  status,
  highlightKeys,
  filledCount,
  totalFields,
  onEditProfile,
}: ChatbotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createMessageId(),
      role: 'assistant',
      content: 'Halo! Aku asisten pengisian formulir lamaran kerja. siap bantu isi form kamu secara pintar.',
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingFill, setPendingFill] = useState<Partial<Record<FieldKey, string>> | null>(null);
  const [pendingSummary, setPendingSummary] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const completionPercent = useMemo(
    () => (totalFields ? Math.round((filledCount / totalFields) * 100) : 0),
    [filledCount, totalFields],
  );
  const progressWidth = useMemo(
    () => Math.min(100, Math.max(0, completionPercent)),
    [completionPercent],
  );
  const highlightCount = highlightKeys.length;

  const statusMeta = useMemo(() => {
    switch (status) {
      case 'processing':
        return {
          label: 'Sedang memproses',
          tone: 'border-amber-200 bg-amber-50 text-amber-700',
        };
      case 'success':
        return {
          label: 'Tersinkron',
          tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        };
      case 'error':
        return {
          label: 'Butuh perhatian',
          tone: 'border-rose-200 bg-rose-50 text-rose-700',
        };
      default:
        return {
          label: 'Siap digunakan',
          tone: 'border-slate-200 bg-slate-100 text-slate-600',
        };
    }
  }, [status]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const adjustTextareaHeight = (element?: HTMLTextAreaElement | null) => {
    const target = element ?? textareaRef.current;
    if (!target) return;
    target.style.height = 'auto';
    const maxHeight = 192; // 12rem
    const nextHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');
    requestAnimationFrame(() => {
      adjustTextareaHeight();
    });

    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: prompt,
      createdAt: new Date(),
    };

    const agentHistory = [...messages, userMsg].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    let userMessageAppended = false;
    const appendUserMessage = () => {
      if (!userMessageAppended) {
        setMessages((prev) => [...prev, userMsg]);
        userMessageAppended = true;
      }
    };

    if (pendingFill) {
      appendUserMessage();
      if (matchesKeyword(prompt, YES_KEYWORDS)) {
        const profileToFill = pendingFill;
        setPendingFill(null);
        setPendingSummary(null);
        setLoading(true);

        const tempId = createMessageId();
        setMessages((prev) => [
          ...prev,
          createTypingMessage(tempId, 'Oke, aku menekan tombol "Isi otomatis sekarang" untukmu…'),
        ]);

        try {
          await dispatchFillCommand(profileToFill, true);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempId
                ? {
                    ...msg,
                    content:
                      'Selesai! Semua field yang terhubung sudah terisi otomatis. Kalau ada yang kurang pas, kamu bisa edit dari panel Smart Autofill.',
                    mood: 'info',
                    createdAt: new Date(),
                  }
                : msg,
            ),
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? `Maaf, aku gagal mengisi form: ${error.message}`
              : 'Maaf, pengisian otomatis gagal dijalankan.';
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempId
                ? {
                    ...msg,
                    content: message,
                    mood: 'error',
                    createdAt: new Date(),
                  }
                : msg,
            ),
          );
        } finally {
          setLoading(false);
        }

        return;
      }

      if (matchesKeyword(prompt, NO_KEYWORDS)) {
        setPendingFill(null);
        setPendingSummary(null);
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content: 'Baik, aku batalkan. Tinggal bilang "isi semua form" kalau ingin ku bantu lagi.',
            createdAt: new Date(),
          },
        ]);
        return;
      }
    }

    appendUserMessage();
    setLoading(true);

    const tempId = createMessageId();
    setMessages((prev) => [
      ...prev,
      createTypingMessage(tempId, 'Ai lagi mikir langkah terbaik…'),
    ]);

    try {
      const agentReply = await requestAgentResponse(agentHistory, {
        filledCount,
        totalFields,
        highlightKeys,
      });

      let assistantContent = agentReply.reply;

      if (agentReply.action === 'fill_forms') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? createTypingMessage(
                  tempId,
                  'Sebentar, aku cek dulu field mana saja yang tersambung…',
                  msg.createdAt,
                )
              : msg,
          ),
        );

        const detectionSummary = await fetchDetectionSummary();
        const summaryText = describeDetectionSummary(detectionSummary) ?? pendingSummary;
        const questionText =
          'Mau kuisi semuanya sekarang? Balas dengan "ya" untuk lanjut atau "tidak" kalau belum perlu.';

        setPendingFill(agentReply.profile ?? {});
        setPendingSummary(summaryText ?? null);

        assistantContent = [agentReply.reply, summaryText, questionText]
          .filter((part): part is string => Boolean(part))
          .join('\n\n');
      } else {
        setPendingFill(null);
        setPendingSummary(null);
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                content: assistantContent,
                mood: undefined,
                createdAt: new Date(),
              }
            : msg,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? `Maaf, aku mengalami kendala: ${error.message}`
          : 'Maaf, aku mengalami kendala tak terduga.';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                content: message,
                mood: 'error',
                createdAt: new Date(),
              }
            : msg,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.mood === 'typing') {
      return <TypingMessage hint={msg.content} />;
    }

    if (msg.mood === 'error') {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-rose-600">Ups, ada kendala</span>
          <span className="text-sm text-rose-700">{msg.content}</span>
        </div>
      );
    }

    return <span className="whitespace-pre-line">{msg.content}</span>;
  };

  return (
    <div className="flex h-full w-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-gradient-to-br from-white/95 via-white/90 to-indigo-50/70 p-4 shadow-sm backdrop-blur-sm sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-800 sm:text-lg">Smart Chat</h3>
          <p className="text-xs text-slate-500 sm:text-sm">
            Ngobrol dengan Ai untuk bantu isi form secara otomatis.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500 sm:gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-1 font-medium text-indigo-600 shadow-sm">
              <span className="font-semibold text-indigo-700">{filledCount}</span>
              /{totalFields || 0} field terisi
            </span>
            {highlightCount > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-600 shadow-sm">
                <Sparkles size={14} className="text-indigo-500" />
                {highlightCount} field prioritas
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs font-medium text-slate-500 sm:text-sm">
            {completionPercent}% profil terisi
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.tone}`}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
              {statusMeta.label}
            </span>
            <button
              type="button"
              onClick={onEditProfile}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 active:scale-[0.98]"
            >
              Kelola Profil
            </button>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 transition-all duration-500 ease-out"
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      {/* Chat Area */}
      <div className="relative mt-5 flex-1 min-h-0">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-inner">
          <div className="flex h-full min-h-0 flex-col space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isTyping = msg.mood === 'typing';
              const isError = msg.mood === 'error';
              const bubbleClass = isUser
                ? 'shadow-md'
                : isTyping
                  ? 'border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-indigo-100 text-indigo-600 shadow-sm'
                  : isError
                    ? 'border border-rose-200 bg-rose-50 text-rose-700 shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 shadow-sm';

              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed transition ${bubbleClass}`}>
                    {renderMessageContent(msg)}
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="relative mt-4 sm:mt-5 ">
        <textarea
          rows={1}
          value={input}
          ref={textareaRef}
          onChange={(e) => {
            setInput(e.target.value);
            adjustTextareaHeight(e.target);
          }}
          onKeyDown={handleKey}
          placeholder={
            pendingFill
              ? 'Tulis "ya" untuk mengisi semua, atau "tidak" kalau mau batal.'
              : 'Ketik pesan untuk Agent Nusa...'
          }
          className="w-full min-h-[6rem] max-h-48 resize-none rounded-2xl border border-slate-400 bg-white/90 px-12 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
        />
        <button
          type="button"
          onClick={onEditProfile}
          disabled={loading}
          className="absolute bottom-3 left-3 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          title="Kelola profil"
          aria-label="Kelola profil Smart Autofill"
        >
          <Sparkles size={16} />
        </button>
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
