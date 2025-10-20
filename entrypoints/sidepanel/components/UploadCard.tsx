import type { ChangeEvent, JSX } from 'react';
import type { ExtractionStatus, StatusMeta } from '../types';

interface UploadCardProps {
  status: ExtractionStatus;
  statusMeta: StatusMeta;
  isProcessing: boolean;
  uploadedFileName: string | null;
  formattedUpdatedAt: string | null;
  filledCount: number;
  totalFields: number;
  error: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  progressTimeline?: JSX.Element | null;
}

const UploadCard = ({
  status,
  statusMeta,
  isProcessing,
  uploadedFileName,
  formattedUpdatedAt,
  filledCount,
  totalFields,
  error,
  onFileChange,
  progressTimeline,
}: UploadCardProps): JSX.Element => {
  const uploadInputId = 'pdf-upload';

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-indigo-100/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Unggah PDF</h2>
          <p className="text-sm text-slate-500">
            Sistem akan memandu Anda melalui tiga langkah hingga profil Anda siap dipakai.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.tone}`}
        >
          {status === 'processing' && <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />}
          {statusMeta.label}
        </span>
      </div>

      <label
        htmlFor={uploadInputId}
        className={`mt-5 flex cursor-pointer flex-col items-center gap-4 rounded-[22px] border border-dashed border-sky-300/80 bg-sky-50/60 p-8 text-center transition ${
          isProcessing ? 'pointer-events-none opacity-70' : 'hover:border-sky-500 hover:bg-sky-100/60'
        }`}
      >
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-200/80 text-sky-600 shadow-inner">
          <svg
            aria-hidden="true"
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 2h6l5 5v11.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5V3.5A1.5 1.5 0 0 1 5.5 2H9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v5h5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 16h6M9 10h2.5" />
          </svg>
        </span>
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-900">Tarik & lepas atau klik untuk memilih PDF</p>
          <p className="text-sm text-slate-500">Ukuran maksimal 10MB, hanya format .pdf</p>
        </div>
      </label>
      <input
        id={uploadInputId}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={onFileChange}
        disabled={isProcessing}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`font-semibold ${statusMeta.highlight}`}>{uploadedFileName ?? 'Belum ada file'}</span>
          {formattedUpdatedAt && (
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
              Diperbarui {formattedUpdatedAt} WIB
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <span>Field terisi</span>
          <span className="text-lg font-semibold text-slate-900">{filledCount}</span>
          <span className="text-slate-400">/ {totalFields}</span>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </p>
      )}

      {progressTimeline ?? null}
    </div>
  );
};

export default UploadCard;
