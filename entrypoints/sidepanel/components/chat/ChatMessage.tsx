import type { JSX } from 'react';

export interface ChatMessageData {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  createdAt: Date;
  mood?: 'typing' | 'error' | 'info';
}

const TypingIndicator = ({ hint }: { hint: string }) => (
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

interface ChatMessageProps {
  message: ChatMessageData;
}

export function ChatMessage({ message }: ChatMessageProps): JSX.Element {
  const isUser = message.role === 'user';
  const isTyping = message.mood === 'typing';
  const isError = message.mood === 'error';

  const bubbleClass = isUser
    ? 'bg-indigo-600 text-white shadow-md'
    : isTyping
      ? 'border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-indigo-100 text-indigo-600 shadow-sm'
      : isError
        ? 'border border-rose-200 bg-rose-50 text-rose-700 shadow-sm'
        : 'border border-slate-200 bg-white text-slate-700 shadow-sm';

  const renderContent = () => {
    if (isTyping) {
      return <TypingIndicator hint={message.content} />;
    }

    if (isError) {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-rose-600">Ups, ada kendala</span>
          <span className="text-sm text-rose-700">{message.content}</span>
        </div>
      );
    }

    return <span className="whitespace-pre-line">{message.content}</span>;
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed transition ${bubbleClass}`}>
        {renderContent()}
      </div>
    </div>
  );
}

export function createMessageId(): string {
  return crypto?.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createTypingMessage(id: string, content: string, createdAt?: Date): ChatMessageData {
  return {
    id,
    role: 'assistant',
    content,
    createdAt: createdAt ?? new Date(),
    mood: 'typing',
  };
}
