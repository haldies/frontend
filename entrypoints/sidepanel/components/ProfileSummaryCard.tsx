import { useMemo } from 'react';
import type { JSX } from 'react';
import type { FieldKey } from '@/modules/autofill/keys';
import type { ProfileFieldState } from '@/modules/autofill/types';
import { User, Pen } from 'lucide-react';

interface ProfilePanelProps {
  profile: Record<FieldKey, ProfileFieldState>;
  onEditClick: (section?: string) => void;
}

const ProfilePanel = ({ profile, onEditClick }: ProfilePanelProps): JSX.Element => {
  const fullName = profile.fullName?.value ?? '';
  const jobTitle = profile.jobTitle?.value ?? '';
  const company = profile.company?.value ?? '';
  const about = profile.about?.value ?? '';

  const initials = useMemo(() => {
    const segments = fullName.trim().split(/\s+/).slice(0, 2);
    return segments.map((s) => s[0]?.toUpperCase() ?? '').join('') || 'NU';
  }, [fullName]);

  const infoGroups: Array<{ id: string; title: string; fields: FieldKey[] }> = [
    {
      id: 'contact',
      title: 'Kontak & Sosial',
      fields: ['email', 'phone', 'linkedin'],
    },
    {
      id: 'education',
      title: 'Pendidikan',
      fields: ['university', 'major', 'educationLevel', 'gpa'],
    },
    {
      id: 'career',
      title: 'Karier & Preferensi',
      fields: ['experience', 'expectedSalary'],
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header Utama */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 text-center sm:text-left">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-2xl font-semibold text-white shadow-md ring-4 ring-indigo-100">
            {initials || <User size={36} />}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{fullName.trim() || 'Nama Kandidat'}</h2>
            <p className="text-sm text-slate-600">{jobTitle || 'Posisi belum diisi'}</p>
            <p className="text-xs text-slate-400">{company || 'Perusahaan belum diisi'}</p>
          </div>
        </div>

        {/* Tombol Edit Semua */}
        <button
          type="button"
          onClick={() => onEditClick()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 hover:shadow"
        >
          <Pen size={16} /> Ubah Profil
        </button>
      </header>

      <div className="my-6 border-t border-slate-200" />

      {/* About Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-500">
            Tentang Saya
          </h3>
          <button
            type="button"
            onClick={() => onEditClick('about')}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition"
          >
            <Pen size={13} /> Ubah
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 shadow-sm hover:border-indigo-200 transition">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {about?.trim().length ? about : (
              <span className="text-slate-400">Belum ada deskripsi tentang diri Anda.</span>
            )}
          </p>
        </div>
      </div>

      {/* Section Data */}
      <div className="space-y-8">
        {infoGroups.map((group) => (
          <div key={group.id}>
            {/* Judul Section */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-500">
                {group.title}
              </h3>
              <button
                type="button"
                onClick={() => onEditClick(group.id)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition"
              >
                <Pen size={13} /> Ubah
              </button>
            </div>

            {/* Data Field */}
            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((key) => {
                const field = profile[key];
                const value = field?.value?.trim();
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-indigo-200 hover:shadow transition"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      {field?.label || key}
                    </p>
                    <p className="text-sm font-medium text-slate-800">
                      {value?.length ? value : <span className="text-slate-400">Belum ada data</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProfilePanel;
