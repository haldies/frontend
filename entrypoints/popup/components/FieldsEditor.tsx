import type { JSX } from 'react';
import { FIELD_KEYS, type FieldKey } from '@/modules/autofill/keys';
import { FIELD_CONFIGS } from '@/modules/autofill/config';
import type { ProfileFieldState } from '@/modules/autofill/types';

interface FieldsEditorProps {
  profile: Record<FieldKey, ProfileFieldState>;
  onToggle: (key: FieldKey) => void;
  onValueChange: (key: FieldKey, value: string) => void;
}

const FieldsEditor = ({ profile, onToggle, onValueChange }: FieldsEditorProps): JSX.Element => {
  const activeCount = FIELD_KEYS.filter((key) => profile[key].enabled).length;

  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-indigo-100/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Kustomisasi Field</h2>
          <p className="text-sm text-slate-500">
            Aktifkan field yang ingin diisi otomatis dan perbarui nilainya jika diperlukan.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>Field aktif</p>
          <p className="text-base font-semibold text-slate-800">{activeCount}</p>
        </div>
      </div>

      <div className="mt-5 grid max-h-[24rem] gap-4 overflow-y-auto pr-1">
        {FIELD_KEYS.map((key) => {
          const field = profile[key];
          const definition = FIELD_CONFIGS[key];
          const isTextarea = field.inputKind === 'textarea';

          return (
            <div key={key} className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-sky-200">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{field.label}</p>
                  <p className="text-xs text-slate-500">{definition.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(key)}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full border border-slate-200 transition-colors ${
                    field.enabled ? 'bg-sky-500/90' : 'bg-slate-200'
                  }`}
                  aria-pressed={field.enabled}
                  aria-label={`Aktifkan ${field.label}`}
                >
                  <span
                    className={`h-6 w-6 transform rounded-full bg-white shadow transition ${
                      field.enabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {isTextarea ? (
                <textarea
                  className="mt-3 w-full rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder={definition.placeholder}
                  rows={3}
                  value={field.value}
                  disabled={!field.enabled}
                  onChange={(event) => onValueChange(key, event.target.value)}
                />
              ) : (
                <input
                  className="mt-3 w-full rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder={definition.placeholder}
                  type={field.inputKind === 'text' ? 'text' : field.inputKind}
                  value={field.value}
                  disabled={!field.enabled}
                  onChange={(event) => onValueChange(key, event.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FieldsEditor;
