import { useEffect, useMemo, useRef, useState } from 'react';
import type { FieldKey } from '@/modules/autofill/types/keys';
import type { ProfileFieldState } from '@/modules/autofill/types/types';
import type { ExtractionStatus, StatusMeta } from '../types';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessage, createMessageId, createTypingMessage, type ChatMessageData } from './chat/ChatMessage';
import { ChatInput } from './chat/ChatInput';
import { scanAndFillForm } from '../services/formAgentService';

const STATUS_META: Record<ExtractionStatus, StatusMeta> = {
  idle: {
    label: 'Menunggu PDF',
    tone: 'border-slate-200 bg-slate-100 text-slate-600',
    highlight: 'text-slate-500',
  },
  processing: {
    label: 'Sedang memproses',
    tone: 'border-sky-300 bg-sky-100 text-sky-700',
    highlight: 'text-sky-600',
  },
  success: {
    label: 'Ekstraksi berhasil',
    tone: 'border-emerald-300 bg-emerald-100 text-emerald-700',
    highlight: 'text-emerald-600',
  },
  error: {
    label: 'Gagal memproses',
    tone: 'border-rose-300 bg-rose-100 text-rose-700',
    highlight: 'text-rose-600',
  },
};

interface ChatbotPanelProps {
  profile: Record<FieldKey, ProfileFieldState>;
  status: ExtractionStatus;
  highlightKeys: FieldKey[];
  filledCount: number;
  totalFields: number;
  onEditProfile: () => void;
}

export default function ChatbotPanel({
  status,
  highlightKeys,
  filledCount,
  totalFields,
  onEditProfile,
}: ChatbotPanelProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>([
    {
      id: createMessageId(),
      role: 'assistant',
      content: 'Hai,',
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [formAgentEnabled, setFormAgentEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const completionPercent = useMemo(
    () => (totalFields ? Math.round((filledCount / totalFields) * 100) : 0),
    [filledCount, totalFields],
  );

  const statusMeta = useMemo(
    () => STATUS_META[status],
    [status],
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (message: ChatMessageData) => {
    setMessages(prev => [...prev, message]);
  };

  const updateMessage = (id: string, updates: Partial<ChatMessageData>) => {
    setMessages(prev =>
      prev.map(msg => (msg.id === id ? { ...msg, ...updates, createdAt: new Date() } : msg))
    );
  };

  const handleSendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: ChatMessageData = {
      id: createMessageId(),
      role: 'user',
      content: prompt,
      createdAt: new Date(),
    };

    addMessage(userMsg);
    setInput('');
    setLoading(true);

    const tempId = createMessageId();
    addMessage(createTypingMessage(tempId, 'Sedang memproses...'));

    try {
      if (!formAgentEnabled) {
        // Form agent not enabled
        updateMessage(tempId, {
          content: 'Aktifkan Form Agent (⚡) dulu untuk aku bisa bantu dengan form!',
          mood: undefined,
        });
        return;
      }

      const result = await scanAndFillForm();

      if (result.success) {
        updateMessage(tempId, {
          content: `${result.message}\n\nSilakan cek form dan edit jika perlu!`,
          mood: 'info',
        });
      } else {
        updateMessage(tempId, {
          content: result.message,
          mood: 'error',
        });
      }
    } catch (error) {
      console.error('Error in chat:', error);
      updateMessage(tempId, {
        content: `Maaf, terjadi kesalahan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mood: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFormAgent = () => {
    const newState = !formAgentEnabled;
    setFormAgentEnabled(newState);    
  };

  const placeholder = formAgentEnabled
    ? 'Ketik "isi form" atau tanya tentang form...'
    : 'Aktifkan Form Agent (⚡) untuk mulai...';

  return (
    <div className="flex h-full w-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-gradient-to-br from-white/95 via-white/90 to-indigo-50/70 p-4 shadow-sm backdrop-blur-sm sm:p-6">
      <ChatHeader
        filledCount={filledCount}
        totalFields={totalFields}
        highlightCount={highlightKeys.length}
        completionPercent={completionPercent}
        statusLabel={statusMeta.label}
        statusTone={statusMeta.tone}
        onEditProfile={onEditProfile}
      />

      {/* Chat Area */}
      <div className="relative mt-5 flex-1 min-h-0">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-inner">
          <div className="flex h-full min-h-0 flex-col space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={scrollRef} />
          </div>
        </div>
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSendMessage}
        loading={loading}
        formAgentEnabled={formAgentEnabled}
        onToggleFormAgent={handleToggleFormAgent}
        placeholder={placeholder}
      />
    </div>
  );
}
