import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading: boolean;
  formAgentEnabled: boolean;
  onToggleFormAgent: () => void;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  loading,
  formAgentEnabled,
  onToggleFormAgent,
  placeholder = 'Ketik pesan untuk Agent Nusa...',
}: ChatInputProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = (element?: HTMLTextAreaElement | null) => {
    const target = element ?? textareaRef.current;
    if (!target) return;
    target.style.height = 'auto';
    const maxHeight = 192;
    const nextHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="relative mt-4 sm:mt-5">
      <textarea
        rows={1}
        value={value}
        ref={textareaRef}
        onChange={(e) => {
          onChange(e.target.value);
          adjustHeight(e.target);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[6rem] max-h-48 resize-none rounded-2xl border border-slate-400 bg-white/90 px-3 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        disabled={loading}
      />
      
      {/* Form Agent Toggle */}
      <button
        type="button"
        onClick={onToggleFormAgent}
        disabled={loading}
        className={`absolute bottom-3 left-3 inline-flex h-6 w-16 items-center justify-center rounded-xl border transition shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
          formAgentEnabled
            ? 'border-purple-300 bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-700 hover:from-purple-200 hover:to-indigo-200'
            : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600'
        }`}
        title={formAgentEnabled ? 'AI Form Agent: Aktif' : 'AI Form Agent: Nonaktif'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Form
      </button>

      {/* Send Button */}
      <button
        onClick={onSend}
        disabled={loading || !value.trim()}
        className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-300"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
      </button>
    </div>
  );
}
