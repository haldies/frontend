import type { JSX } from 'react';


interface ChatHeaderProps {
  filledCount: number;
  totalFields: number;
  highlightCount: number;
  completionPercent: number;
  statusLabel: string;
  statusTone: string;
  onEditProfile: () => void;
}

export function ChatHeader({
  completionPercent,
}: ChatHeaderProps): JSX.Element {
  const progressWidth = Math.min(100, Math.max(0, completionPercent));

  return (
    <>
      {/* Header Info */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-800 sm:text-lg">Smart Chat</h3>
          <p className="text-xs text-slate-500 sm:text-sm">
            Ngobrol dengan AI untuk bantu isi form secara otomatis.
          </p>
        </div>
      </div>

    </>
  );
}
