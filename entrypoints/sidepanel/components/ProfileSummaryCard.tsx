import { useMemo } from 'react';
import type { JSX } from 'react';
import type { ProfileFieldState } from '@/modules/autofill/types';
import { User, Pen, Mail, Phone, Linkedin, MapPin, Sparkles } from 'lucide-react';

import PostFormWrapper from './PostFormWrapper';

interface ProfilePanelProps {
  profile: Record<string, unknown>;
  onEditClick?: (section?: string) => void;
}

type ExperienceEntry = {
  role?: string;
  company?: string;
  period?: string;
  description?: string;
  summary?: string;
};

function isProfileFieldState(value: unknown): value is ProfileFieldState {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'value' in (value as Record<string, unknown>) &&
      typeof (value as { value?: unknown }).value !== 'undefined',
  );
}

function toStringValue(value: unknown): string {
  if (isProfileFieldState(value)) {
    const raw = (value as ProfileFieldState).value;
    return typeof raw === 'string' ? raw : raw != null ? String(raw) : '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function getRawValue(profile: Record<string, unknown>, key: string): unknown {
  if (!profile) {
    return undefined;
  }

  if (key in profile) {
    return profile[key];
  }

  const nested = profile.profile;
  if (nested && typeof nested === 'object' && nested !== null) {
    const nestedRecord = nested as Record<string, unknown>;
    if (key in nestedRecord) {
      return nestedRecord[key];
    }
  }

  return undefined;
}

function getStringValue(profile: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = toStringValue(getRawValue(profile, key)).trim();
    if (value.length > 0) {
      return value;
    }
  }
  return '';
}

function normalizeExperience(value: unknown): ExperienceEntry[] {
  const raw = isProfileFieldState(value) ? value.value : value;

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const record = item as Record<string, unknown>;
        const role = toStringValue(record.role).trim() || toStringValue(record.title).trim();
        const company = toStringValue(record.company).trim();
        const period = toStringValue(record.period).trim();
        const description = toStringValue(record.description).trim();

        if (!role && !company && !period && !description) {
          return null;
        }

        return {
          role: role || undefined,
          company: company || undefined,
          period: period || undefined,
          description: description || undefined,
        };
      })
      .filter((item): item is ExperienceEntry => Boolean(item));
  }

  if (typeof raw === 'string') {
    const lines = raw
      .split(/\r?\n+/)
      .map((line) => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => ({ summary: line }));
  }

  return [];
}

function normalizeSkills(value: unknown): string[] {
  const raw = isProfileFieldState(value) ? value.value : value;

  if (Array.isArray(raw)) {
    return raw
      .map((item) => toStringValue(item).trim())
      .filter((item) => item.length > 0);
  }

  if (typeof raw === 'string') {
    return raw
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

const ProfilePanel = ({ profile, onEditClick }: ProfilePanelProps): JSX.Element => {
  const fullName = getStringValue(profile, 'fullName');
  const jobTitle = getStringValue(profile, 'jobTitle');
  const company = getStringValue(profile, 'company');
  const about = getStringValue(profile, 'aboutMe', 'about', 'summary');

  const email = getStringValue(profile, 'email');
  const phone = getStringValue(profile, 'phone', 'whatsapp');
  const linkedin = getStringValue(profile, 'linkedin');
  const address = getStringValue(profile, 'address');
  const placeOfBirth = getStringValue(profile, 'placeOfBirth');
  const dateOfBirth = getStringValue(profile, 'dateOfBirth');

  const university = getStringValue(profile, 'university');
  const major = getStringValue(profile, 'major');
  const educationLevel = getStringValue(profile, 'educationLevel');
  const gpa = getStringValue(profile, 'gpa');

  const experiences = normalizeExperience(getRawValue(profile, 'experience'));
  const skills = normalizeSkills(getRawValue(profile, 'skills'));

  const experienceEntries =
    experiences.length > 0
      ? experiences
      : (() => {
          const fallbackTitle = [jobTitle, company].filter(Boolean).join(' • ');
          return fallbackTitle ? [{ summary: fallbackTitle }] : [];
        })();

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header */}
      <header className="flex flex-col gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex items-center ">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {fullName.trim() || 'Nama Kandidat'}
            </h2>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm text-slate-600 sm:justify-start">
              {email && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={14} className="text-indigo-500" /> {email}
                </span>
              )}
              {phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={14} className="text-indigo-500" /> {phone}
                </span>
              )}
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-indigo-600 transition"
                >
                  <Linkedin size={14} className="text-indigo-500" /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {onEditClick ? (
          <button
            type="button"
            onClick={() => onEditClick()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 hover:shadow"
          >
            <Pen size={16}/> Ubah Profil
          </button>
        ) : null}
      </header>

      <div className="my-6 border-t border-slate-200" />

      {/* Tentang Saya */}
      <section>
        <SectionHeader title="Tentang Saya" sectionKey="about" onEdit={onEditClick} />
        <CardText value={about} placeholder="Belum ada deskripsi tentang diri Anda." />
      </section>

      {/* Informasi Pribadi */}
      <section className="mt-8">
        <SectionHeader title="Informasi Pribadi" sectionKey="personal" onEdit={onEditClick} />
        <CardList
          items={[
            placeOfBirth && dateOfBirth
              ? `Tempat & Tanggal Lahir: ${placeOfBirth}, ${dateOfBirth}`
              : placeOfBirth
                ? `Tempat Lahir: ${placeOfBirth}`
                : dateOfBirth
                  ? `Tanggal Lahir: ${dateOfBirth}`
                  : undefined,
            address && !address.includes(placeOfBirth) ? `Domisili: ${address}` : undefined,
          ]}
        />
      </section>

      {/* Pendidikan */}
      <section className="mt-8">
        <SectionHeader title="Pendidikan" sectionKey="education" onEdit={onEditClick} />
        <CardList
          items={[
            university ? `Universitas: ${university}` : undefined,
            major ? `Jurusan: ${major}` : undefined,
            educationLevel ? `Jenjang: ${educationLevel}` : undefined,
            gpa ? `IPK: ${gpa}` : undefined,
          ]}
        />
      </section>

      {/* Pengalaman */}
      <section className="mt-8">
        <SectionHeader title="Pengalaman" sectionKey="career" onEdit={onEditClick} />
        <ExperienceList items={experienceEntries} />
      </section>

      {/* Keahlian */}
      <section className="mt-8">
        <SectionHeader title="Keahlian" sectionKey="skills" onEdit={onEditClick} />
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-sm text-indigo-600 shadow-sm"
              >
                <Sparkles size={14} className="text-indigo-500" />
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-400 text-sm">Belum ada data keahlian</span>
        )}
      </section>
      <PostFormWrapper/>
    </section>
  );
};

/* === Reusable Components === */
const AvatarFallback = ({ fullName }: { fullName: string }) => {
  const initials = useMemo(() => {
    const segments = fullName.trim().split(/\s+/).slice(0, 2);
    return segments.map((segment) => segment[0]?.toUpperCase() ?? '').join('');
  }, [fullName]);

  return initials ? <span>{initials}</span> : <User size={36} />;
};

const SectionHeader = ({
  title,
  sectionKey,
  onEdit,
}: {
  title: string;
  sectionKey?: string;
  onEdit?: (section?: string) => void;
}) => (
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-500">{title}</h3>
    {onEdit ? (
      <button
        type="button"
        onClick={() => onEdit(sectionKey)}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
      >
        <Pen size={13} /> Ubah
      </button>
    ) : null}
  </div>
);

const CardText = ({ value, placeholder }: { value?: string; placeholder: string }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 shadow-sm hover:border-indigo-200 transition">
    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
      {value?.trim()?.length ? value : <span className="text-slate-400">{placeholder}</span>}
    </p>
  </div>
);

const CardList = ({ items }: { items: (string | undefined)[] }) => (
  <div className="flex flex-wrap gap-2">
    {items.filter(Boolean).length > 0 ? (
      items.filter(Boolean).map((item, i) => (
        <span
          key={i}
          className="bg-slate-50 border border-slate-100 rounded-full px-3 py-1 text-sm text-slate-700"
        >
          {item}
        </span>
      ))
    ) : (
      <span className="text-slate-400 text-sm">Belum ada data</span>
    )}
  </div>
);

const ExperienceList = ({ items }: { items: ExperienceEntry[] }) => {
  if (!items.length) {
    return <span className="text-slate-400 text-sm">Belum ada data pengalaman</span>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const key = [item.role, item.company, item.period, item.summary, index].filter(Boolean).join('-');
        return (
          <div
            key={key || index}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            {item.summary ? (
              <p className="text-sm text-slate-700 leading-relaxed">{item.summary}</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {[item.role, item.company].filter(Boolean).join(' • ') || 'Pengalaman'}
                </p>
                {item.period && <p className="text-xs text-slate-500">{item.period}</p>}
                {item.description && (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {item.description}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProfilePanel;
