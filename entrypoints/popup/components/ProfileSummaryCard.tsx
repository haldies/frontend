import type { JSX } from 'react';
import type { FieldKey } from '@/modules/autofill/keys';
import type { ProfileFieldState } from '@/modules/autofill/types';

interface ProfileSummaryCardProps {
  profile: Record<FieldKey, ProfileFieldState>;
  highlightKeys: FieldKey[];
  onEditClick: () => void;
}

const ProfileSummaryCard = ({ profile, highlightKeys, onEditClick }: ProfileSummaryCardProps): JSX.Element => {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white/85 p-6 shadow-lg shadow-indigo-100/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ringkasan Profil</h2>
          <p className="text-sm text-slate-500">
            Hasil ekstraksi utama. Sesuaikan detail lengkap pada tab &quot;Kustomisasi Field&quot;.
          </p>
        </div>
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100/80 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
        >
          Atur Field &gt;
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        {highlightKeys.map((key) => {
          const field = profile[key];
          const value = field.value.trim();
          return (
            <div key={key} className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{field.label}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{value.length > 0 ? value : 'N/A'}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileSummaryCard;
