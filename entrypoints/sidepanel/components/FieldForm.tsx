import { triggerDetectionFromSidepanel, triggerConfigRefresh } from '@/utils/messaging';
import { ensureFieldConfigsReady, getFieldConfigsSync, refreshConfigsFromApi } from '@/modules/autofill/core/config';
import { fieldConfigApi } from '@/modules/autofill/api/fieldConfigApi';
import { useState, FormEvent, useEffect } from 'react';
import type { FieldDefinition } from '@/modules/autofill/types/types';
// FieldKey tidak digunakan lagi, kami gunakan numeric ID langsung

// Type for field configs using numeric ID
type FieldConfig = {
  id: number;
  config: FieldDefinition;
  isEditing?: boolean;
};

// Default initial field configuration
const DEFAULT_FIELD: FieldDefinition = {
  id: 0,
  label: '',
  placeholder: '',
  description: '',
  defaultValue: '',
  defaultEnabled: true,
  keywords: [],
  inputKind: 'text',
  requireKeyword: false,
};


// Type for field configs using numeric ID (already defined above)

export default function FieldForm(): JSX.Element {
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [newField, setNewField] = useState<FieldDefinition>(DEFAULT_FIELD);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newFieldError, setNewFieldError] = useState<string | null>(null);
  const [newFieldSuccess, setNewFieldSuccess] = useState<string | null>(null);
  const [newFieldPending, setNewFieldPending] = useState(false);
  
  const updateField = (patch: Partial<FieldDefinition>) => {
    setNewField((prev) => ({ ...prev, ...patch }));
    if (newFieldError) {
      setNewFieldError(null);
    }
    if (newFieldSuccess) {
      setNewFieldSuccess(null);
    }
  };

  const loadFieldConfigs = async () => {
    try {
      await ensureFieldConfigsReady();
      const configs = getFieldConfigsSync();
      const fieldConfigList: FieldConfig[] = Object.entries(configs).map(([id, config]) => ({
        id: parseInt(id),
        config,
        isEditing: false
      }));
      setFieldConfigs(fieldConfigList);
    } catch (error) {
      console.error('❌ Failed to load field configs:', error);
    }
  };

  
  const startEditField = (id: number) => {
    const fieldConfig = fieldConfigs.find(fc => fc.id === id);
    if (fieldConfig) {
      setNewField({ ...fieldConfig.config });
      setEditingId(id);
      setNewFieldError(null);
      setNewFieldSuccess(null);
    }
  };

  const cancelEdit = () => {
    setNewField(DEFAULT_FIELD);
    setEditingId(null);
    setNewFieldError(null);
    setNewFieldSuccess(null);
  };

  const deleteField = async (id: number) => {
    const fieldConfig = fieldConfigs.find(fc => fc.id === id);
    const fieldTitle = fieldConfig?.config.label || `Field ${id}`;
    if (confirm(`Are you sure you want to delete field "${fieldTitle}"?`)) {
      try {
        await fieldConfigApi.deleteField(id);
        setNewFieldSuccess(`Field "${fieldTitle}" deleted successfully!`);
        setTimeout(() => setNewFieldSuccess(null), 3000);

        // Refresh field configurations from API and trigger detection
        setTimeout(async () => {
          try {
            await refreshConfigsFromApi();
            await loadFieldConfigs();
            await triggerDetectionFromSidepanel();
          } catch (error) {
            console.error('❌ Failed to refresh configs after deletion:', error);
          }
        }, 300);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete field.';
        setNewFieldError(message);
      }
    }
  };

  const handleManualTriggerDetection = async () => {
    console.log('🔄 Manual trigger detection...');
    try {
      // First refresh configs from API
      await refreshConfigsFromApi();
      await loadFieldConfigs();

      // Then trigger detection
      const success = await triggerDetectionFromSidepanel();
      if (success) {
        setNewFieldSuccess('✅ Configs refreshed and detection triggered successfully!');
      } else {
        setNewFieldError('❌ Failed to trigger detection');
      }
    } catch (error) {
      console.error('❌ Failed to refresh configs and trigger detection:', error);
      setNewFieldError('❌ Failed to refresh configs or trigger detection');
    }

    setTimeout(() => {
      setNewFieldSuccess(null);
      setNewFieldError(null);
    }, 2000);
  };

  const handleResetToDefaults = async () => {
    if (confirm('Are you sure you want to reset all fields to default configurations? This will delete all custom fields.')) {
      try {
        setNewFieldPending(true);
        await fieldConfigApi.resetToDefaults();
        setNewFieldSuccess('✅ All fields reset to defaults successfully!');

        // Refresh local configs and trigger detection
        setTimeout(async () => {
          try {
            await refreshConfigsFromApi();
            await loadFieldConfigs();
            await triggerDetectionFromSidepanel();
          } catch (error) {
            console.error('❌ Failed to refresh configs after reset:', error);
          }
        }, 300);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to reset fields.';
        setNewFieldError(message);
      } finally {
        setNewFieldPending(false);
        setTimeout(() => setNewFieldSuccess(null), 3000);
      }
    }
  };

  // Load field configurations and existing fields on component mount
  useEffect(() => {
    void loadFieldConfigs();
  }, []);

  // Refresh after save
  useEffect(() => {
    if (newFieldSuccess) {
      void loadFieldConfigs();
    }
  }, [newFieldSuccess]);

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
    setNewFieldSuccess(null);

    if (!newField.label) {
      setNewFieldError('Title harus diisi.');
      return;
    }

    setNewFieldPending(true);
    try {
      let savedField;

      if (editingId) {
        // Update existing field
        savedField = await fieldConfigApi.updateField(editingId, newField);
        console.log('✅ Field configuration updated:', editingId, newField);
      } else {
        // Create new field
        savedField = await fieldConfigApi.createField({
          label: newField.label,
          default_value: newField.defaultValue,
          default_enabled: newField.defaultEnabled,
          keywords: newField.keywords,
          input_kind: newField.inputKind,
          require_keyword: newField.requireKeyword,
        });
        console.log('✅ Field configuration created:', savedField);
      }

      // Trigger detection in content script via messaging
      console.log('📤 Triggering detection in content script...');
      setTimeout(async () => {
        try {
          // First refresh configs from API
          await refreshConfigsFromApi();
          await loadFieldConfigs();

          // Then trigger detection
          const success = await triggerDetectionFromSidepanel();
          if (success) {
            console.log('✅ Detection triggered successfully in content script');
            setNewFieldSuccess(`✅ Field ${editingId ? 'updated' : 'created'}! Detection is running with new configuration...`);
          } else {
            console.warn('⚠️ Failed to trigger detection in content script');
            setNewFieldSuccess(`✅ Field ${editingId ? 'updated' : 'created'}! But detection might not run automatically.`);
          }
        } catch (error) {
          console.error('❌ Error triggering detection:', error);
          setNewFieldSuccess(`✅ Field ${editingId ? 'updated' : 'created'}! Error occurred while running detection.`);
        }
      }, 300);

      // Clear form and exit edit mode
      setTimeout(() => {
        setNewField(DEFAULT_FIELD);
        setEditingId(null);
        setNewFieldSuccess(null);
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save the field.';
      setNewFieldError(message);
    } finally {
      setNewFieldPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-6">
      {/* Field Configurations Section */}
      {fieldConfigs.length > 0 && (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/95 p-6 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-blue-700">Field Configurations ({fieldConfigs.length})</h2>
            <p className="mt-1 text-sm text-slate-600">
              Konfigurasi field yang bisa digunakan untuk auto-fill detection.
            </p>
          </header>

          <div className="space-y-3">
            {fieldConfigs.map((fieldConfig) => (
              <div key={fieldConfig.id} className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-slate-800">{fieldConfig.config.label}</h3>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                        {fieldConfig.config.inputKind}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                        ID: {fieldConfig.id}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {fieldConfig.config.keywords.map((keyword, kwIndex) => (
                        <span
                          key={kwIndex}
                          className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => startEditField(fieldConfig.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteField(fieldConfig.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              disabled={newFieldPending}
            >
              🔄 Reset to Defaults
            </button>
            <button
              type="button"
              onClick={handleManualTriggerDetection}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
            >
              🔄 Refresh & Detect
            </button>
          </div>
        </section>
      )}

      {/* Existing Fields Section - Disabled after IndexedDB removal */}

      {/* Add New Field Section */}
      <section className="rounded-2xl border border-indigo-100 bg-white/95 p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-indigo-700">
            {editingId ? `Edit Field (ID: ${editingId})` : 'Tambah Field Baru'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {editingId
              ? 'Edit konfigurasi field yang sudah ada.'
              : 'Tambah custom field untuk mendeteksi form fields spesifik (contoh: Nomor HP, Alamat, dll).'
            }
          </p>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-gray-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-600"
            >
              ❌ Cancel Edit
            </button>
          )}
        </header>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="field-title">
              Title
            </label>
            <input
              id="field-title"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="contoh: Nama Lengkap"
              value={newField.label}
              onChange={(e) => updateField({ label: e.target.value })}
              disabled={newFieldPending}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="field-defaultValue">
              Default Value
            </label>
            <input
              id="field-defaultValue"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Nilai default jika ada"
              value={newField.defaultValue}
              onChange={(e) => updateField({ defaultValue: e.target.value })}
              disabled={newFieldPending}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="field-inputKind">
              Input Type
            </label>
            <select
              id="field-inputKind"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={newField.inputKind}
              onChange={(e) => updateField({ inputKind: e.target.value as FieldDefinition['inputKind'] })}
              disabled={newFieldPending}
            >
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="tel">Phone</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="password">Password</option>
              <option value="url">URL</option>
              <option value="textarea">Textarea</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newField.defaultEnabled}
                onChange={(e) => updateField({ defaultEnabled: e.target.checked })}
                disabled={newFieldPending}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Enabled by default</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newField.requireKeyword}
                onChange={(e) => updateField({ requireKeyword: e.target.checked })}
                disabled={newFieldPending}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Require keyword match</span>
            </label>
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
          {newFieldSuccess && (
            <div className="sm:col-span-2 text-sm text-green-600">{newFieldSuccess}</div>
          )}

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              disabled={newFieldPending}
            >
              {newFieldPending
                ? 'Menyimpan...'
                : editingId
                  ? 'Update Field'
                  : 'Simpan Field'
              }
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
