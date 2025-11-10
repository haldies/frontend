import { saveFieldToDb } from '@/modules/autofill/indexedDb';
import { useState, FormEvent } from 'react';
type SimpleFieldForm = {
  label: string;
  keywords: string[];
};

const INITIAL_FIELD = {
  label: '',
  keywords: [],
};

export default function FieldForm(): JSX.Element {
  const [newField, setNewField] = useState<SimpleFieldForm>(INITIAL_FIELD);
  const [newFieldError, setNewFieldError] = useState<string | null>(null);
  const [newFieldPending, setNewFieldPending] = useState(false);

  const updateField = (patch: Partial<SimpleFieldForm>) => {
    setNewField((prev) => ({ ...prev, ...patch }));
    if (newFieldError) {
      setNewFieldError(null);
    }
  };

  const handleKeywordAdd = (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed || newField.keywords.includes(trimmed)) return;
    setNewField((prev) => ({
      ...prev,
      keywords: [...prev.keywords, trimmed],
    }));
  };

  const handleKeywordRemove = (index: number) => {
    setNewField((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewFieldError(null);

    if (!newField.label) {
      setNewFieldError('Key and Label are required.');
      return;
    }

    setNewFieldPending(true);
    try {
      await saveFieldToDb(newField);
      console.log('Field saved to IndexedDB:', newField);

    

      setNewField(INITIAL_FIELD); 
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save the field.';
      setNewFieldError(message);
    } finally {
      setNewFieldPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-6">
      <section className="rounded-2xl border border-indigo-100 bg-white/95 p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-indigo-700">Tambah Field Baru</h2>
          <p className="mt-1 text-sm text-slate-500">
            Buat field baru untuk Nama Lengkap atau Email.
          </p>
        </header>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="field-label">
              Label
            </label>
            <input
              id="field-label"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="contoh: Nama Lengkap"
              value={newField.label}
              onChange={(e) => updateField({ label: e.target.value })}
              disabled={newFieldPending}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Keywords</label>
            <KeywordManager
              keywords={newField.keywords}
              onAdd={handleKeywordAdd}
              onRemove={handleKeywordRemove}
              disabled={newFieldPending}
              placeholder="Tambah keyword baru..."
            />
          </div>

          {newFieldError && (
            <div className="sm:col-span-2 text-sm text-rose-600">{newFieldError}</div>
          )}

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              disabled={newFieldPending}
            >
              {newFieldPending ? 'Menyimpan...' : 'Simpan Field'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

type KeywordManagerProps = {
  keywords: string[];
  onAdd: (keyword: string) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  placeholder?: string;
};

function KeywordManager({
  keywords,
  onAdd,
  onRemove,
  disabled = false,
  placeholder = 'Tambah keyword...',
}: KeywordManagerProps): JSX.Element {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInputValue('');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button" // Changed to type="button" to avoid submitting the parent form
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-50"
          disabled={disabled}
          onClick={handleAdd}
        >
          Tambah
        </button>
      </div>

      {keywords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <span
              key={`${keyword}-${index}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {keyword}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                disabled={disabled}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Belum ada keyword.</p>
      )}
    </div>
  );
}
