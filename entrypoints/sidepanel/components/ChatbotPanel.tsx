import { useEffect, useMemo, useRef, useState } from 'react';
import type { FieldKey } from '@/modules/autofill/keys';
import type { ProfileFieldState } from '@/modules/autofill/types';
import type { ExtractionStatus } from '../types';
import { Send, Sparkles } from 'lucide-react';

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
  mood?: 'typing' | 'error';
};

function createMessageId() {
  return crypto?.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ChatbotPanel({
  profile,
  status,
  highlightKeys,
  filledCount,
  totalFields,
}: ChatbotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createMessageId(),
      role: 'assistant',
      content: 'Halo! Aku Agent Nusa 🤖 Siap bantu optimasi profil dan strategi karier kamu.',
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const completionPercent = useMemo(
    () => (totalFields ? Math.round((filledCount / totalFields) * 100) : 0),
    [filledCount, totalFields]
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: prompt,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const tempId = createMessageId();
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'assistant', content: '...', createdAt: new Date(), mood: 'typing' },
    ]);

    try {
      const reply = await buildAssistantReply(prompt, completionPercent);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, content: reply, mood: undefined, createdAt: new Date() } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
              ...m,
              content: '⚠️ Maaf, aku lagi error nih. Coba kirim lagi ya.',
              mood: 'error',
            }
            : m
        )
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

  return (
    <div className="flex flex-col h-[34rem] w-full rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur p-5">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
        <h3 className="text-sm font-semibold text-slate-700">Agent Nusa Chat</h3>
        <span className="text-xs text-slate-500">{completionPercent}% profil terisi</span>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isTyping = msg.mood === 'typing';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm ${isUser
                    ? 'bg-indigo-600 text-white'
                    : isTyping
                      ? 'bg-slate-200 text-slate-500 animate-pulse'
                      : 'bg-slate-100 text-slate-800'
                  }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="relative mt-3">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ketik pesan untuk Agent Nusa..."
          className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
          disabled={loading}
        />
        <button
          type="button"
          className="absolute left-2 bottom-2.5 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
          title="AI Tools"
        >
          <Sparkles size={16} />
        </button>
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="absolute right-2 bottom-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

async function buildAssistantReply(prompt: string, completion: number): Promise<string> {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
  const lower = prompt.toLowerCase();

  if (lower.includes('ringkasan')) {
    return 'Gunakan 2–3 pencapaian utama dan angka konkret. Ringkas, tapi menunjukkan dampak kamu.';
  }
  if (lower.includes('interview')) {
    return 'Persiapkan jawaban pakai metode STAR dan hubungkan pengalamanmu dengan peran yang kamu lamar.';
  }
  if (lower.includes('next') || lower.includes('lanjut')) {
    return 'Langkah selanjutnya: rapikan narasi, tambah kontak aktif, lalu kirim ke HR lewat email profesional.';
  }

  return `Menarik! Berdasarkan profil kamu yang terisi ${completion}%, aku sarankan fokus ke pengalaman yang paling relevan.`;
}
