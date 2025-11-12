import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2,  AlertCircle } from 'lucide-react';

interface FormInfo {
  id: string;
  action: string;
  method: string;
  fieldCount: number;
  fields: FieldInfo[];
}

interface FieldInfo {
  index: number;
  type: string;
  id: string;
  name: string;
  placeholder: string;
  labelText: string;
  hints: string;
  isRequired: boolean;
  autocomplete: string;
  detectedAs?: string;
  score?: number;
  value?: string; // For storing user input
  elementIndex?: number; // To identify the element in content script
}

const ScanFormPanel = (): JSX.Element => {
  const [forms, setForms] = useState<FormInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  const scanCurrentPage = async () => {
    setIsScanning(true);
    
    try {
      // Send message through background script to content script
      const response = await browser.runtime.sendMessage({
        action: 'sendMessageToContentScript',
        message: {
          type: 'SCAN_FORMS',
        },
      });

      console.log('📨 Scan response:', response);

      if (response?.success && response?.response?.forms) {
        const receivedForms = response.response.forms;
        console.log('✅ Received forms in sidepanel:', receivedForms);
        console.log('📊 Total forms:', receivedForms.length);
        receivedForms.forEach((form: FormInfo, idx: number) => {
          console.log(`📄 Form ${idx + 1}: ${form.id} - ${form.fieldCount} fields`);
          form.fields.forEach((field: FieldInfo, fieldIdx: number) => {
            console.log(`  🔸 Field ${fieldIdx + 1}: ${field.labelText || field.name || field.id} (${field.type})`);
          });
        });
        setForms(receivedForms);
        setLastScanTime(new Date());
      } else {
        console.warn('No forms found or scan failed');
        setForms([]);
      }
    } catch (error) {
      console.error('Error scanning forms:', error);
      setForms([]);
    } finally {
      setIsScanning(false);
    }
  };

  const fillFormWithAI = async (formIndex: number) => {
    setIsFilling(true);
    
    try {
      const form = forms[formIndex];
      
      // Get user profile from storage using chrome API
      const chromeApi = (globalThis as any).chrome;
      let userProfile: Record<string, string> = {};
      
      if (chromeApi?.storage?.local) {
        try {
          const result = await chromeApi.storage.local.get('smartAutofillState/v1');
          const stateData = result['smartAutofillState/v1'];
          
          console.log('📦 Raw storage data:', stateData);
          
          if (stateData?.profile) {
            Object.entries(stateData.profile).forEach(([key, value]: [string, any]) => {
              if (value?.value) {
                const label = value.label || key;
                userProfile[label] = value.value;
              }
            });
          }
        } catch (error) {
          console.error('Error reading storage:', error);
        }
      }

      // If no profile, try to get from API
      if (Object.keys(userProfile).length === 0) {
        try {
          const profileResponse = await fetch('http://localhost:8000/api/profile');
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            if (profileData.profile) {
              const profile = profileData.profile;
              
              // Map profile fields to readable labels
              if (profile.fullName) userProfile['Nama Lengkap'] = profile.fullName;
              if (profile.email) userProfile['Email'] = profile.email;
              if (profile.phone) userProfile['Telepon'] = profile.phone;
              if (profile.placeOfBirth) userProfile['Tempat Lahir'] = profile.placeOfBirth;
              if (profile.dateOfBirth) userProfile['Tanggal Lahir'] = profile.dateOfBirth;
              if (profile.address) userProfile['Alamat'] = profile.address;
              if (profile.university) userProfile['Universitas'] = profile.university;
              if (profile.educationLevel) userProfile['Jenjang Pendidikan'] = profile.educationLevel;
              if (profile.major) userProfile['Jurusan'] = profile.major;
              if (profile.gpa) userProfile['IPK'] = String(profile.gpa);
              if (profile.skills) userProfile['Keahlian'] = profile.skills;
              if (profile.linkedin) userProfile['LinkedIn'] = profile.linkedin;
              if (profile.aboutMe) userProfile['Tentang Saya'] = profile.aboutMe;
              
              // Handle experience array
              if (profile.experience && Array.isArray(profile.experience)) {
                const expText = profile.experience.map((exp: any, idx: number) => 
                  `${idx + 1}. ${exp.role} di ${exp.company} (${exp.period})`
                ).join('; ');
                userProfile['Pengalaman Kerja'] = expText;
              }
            }
          }
        } catch (error) {
          console.warn('Could not fetch profile from API:', error);
        }
      }

      console.log('📝 User profile for AI:', userProfile);

      // Call AI backend
      const response = await fetch('http://localhost:8000/api/agent/fill-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: form.fields,
          profile: userProfile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'AI gagal generate jawaban');
      }

      const data = await response.json();
      const answers = data.answers;

      console.log('🤖 AI generated answers:', answers);

      // Update form fields with AI answers
      setForms(prevForms => {
        const newForms = [...prevForms];
        newForms[formIndex].fields = newForms[formIndex].fields.map(field => ({
          ...field,
          value: answers[field.index.toString()] || field.value || '',
        }));
        return newForms;
      });

      alert(`AI berhasil generate ${Object.keys(answers).length} jawaban! Review dan klik "Isi Form" untuk apply.`);
    } catch (error) {
      console.error('Error AI fill:', error);
      alert(`Gagal generate jawaban dengan AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFilling(false);
    }
  };

  const fillForm = async (formIndex: number) => {
    setIsFilling(true);
    
    try {
      const form = forms[formIndex];
      const fieldsToFill = form.fields
        .filter(f => f.value && f.value.trim())
        .map(f => ({
          index: f.index,
          value: f.value,
        }));

      if (fieldsToFill.length === 0) {
        alert('Tidak ada field yang diisi!');
        setIsFilling(false);
        return;
      }

      const response = await browser.runtime.sendMessage({
        action: 'sendMessageToContentScript',
        message: {
          type: 'FILL_FORM',
          formIndex,
          fields: fieldsToFill,
        },
      });

      if (response?.success) {
        alert(`Berhasil mengisi ${fieldsToFill.length} field!`);
      } else {
        alert('Gagal mengisi form!');
      }
    } catch (error) {
      console.error('Error filling form:', error);
      alert('Terjadi kesalahan saat mengisi form!');
    } finally {
      setIsFilling(false);
    }
  };

  const updateFieldValue = (formIndex: number, fieldIndex: number, value: string) => {
    setForms(prevForms => {
      const newForms = [...prevForms];
      newForms[formIndex].fields[fieldIndex].value = value;
      return newForms;
    });
  };

  useEffect(() => {
    // Auto-scan on mount
    void scanCurrentPage();
  }, []);

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  return (
    <div className="flex flex-col gap-4 h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Deteksi Form</h2>
          <p className="text-sm text-slate-500">
            {lastScanTime ? `Terakhir dipindai: ${formatTime(lastScanTime)}` : 'Belum dipindai'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void scanCurrentPage()}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
          {isScanning ? 'Memindai...' : 'Pindai'}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Summary Stats */}
        {forms.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-50 to-sky-50 rounded-2xl p-4 border border-indigo-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {forms.length}
                </div>
                <div className="text-xs text-slate-600 mt-1">Form{forms.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-700">
                  {forms.reduce((sum, f) => sum + f.fieldCount, 0)}
                </div>
                <div className="text-xs text-slate-600 mt-1">Total Fields</div>
              </div>
            </div>
          </div>
        )}
        
        {forms.length === 0 && !isScanning && (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
            <AlertCircle size={48} className="mx-auto text-slate-400 mb-3" />
            <p className="text-slate-600">Tidak ada form terdeteksi di halaman ini</p>
            <p className="text-sm text-slate-500 mt-2">
              Pastikan Anda berada di halaman dengan formulir
            </p>
          </div>
        )}

        {forms.map((form, formIndex) => {
          const detectedCount = form.fields.filter((f: any) => f.detectedAs).length;
          const detectionRate = form.fieldCount > 0 ? Math.round((detectedCount / form.fieldCount) * 100) : 0;
          
          return (
            <div
              key={formIndex}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200"
            >
              {/* Action Buttons */}
              <div className="mb-4 flex flex-col gap-2">
                <div className="flex gap-2">
                  {form.action && form.action !== 'none' && form.action !== '' && (
                    <a 
                      href={form.action} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Buka Form
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void fillForm(formIndex)}
                    disabled={isFilling}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isFilling ? 'Mengisi...' : 'Isi Form'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void fillFormWithAI(formIndex)}
                  disabled={isFilling}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {isFilling ? 'AI Sedang Berpikir...' : 'Generate AI'}
                </button>
              </div>

            {/* Fields */}
            <div className="space-y-2">
              {form.fields.map((field, fieldIndex) => {
                const hasLabel = field.labelText && field.labelText.trim();
                // Use hints as fallback if no label (hints contains name, id, placeholder, aria-label)
                const displayTitle = hasLabel 
                  || field.hints 
                  || field.placeholder 
                  || field.name 
                  || field.id 
                  || `Field ${fieldIndex + 1}`;
                
                return (
                  <div
                    key={fieldIndex}
                    className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Title & Badges */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-slate-800 truncate">
                            {displayTitle}
                          </h4>
                          <span className="text-xs font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                            {field.type}
                          </span>
                          {field.isRequired && (
                            <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded shrink-0">
                              Required
                            </span>
                          )}
                        </div>
                        
                        {/* Detection Status - Only show if detected */}
                        {field.detectedAs && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span className="text-xs text-emerald-700 font-medium">
                              Terdeteksi sebagai: {field.detectedAs}
                            </span>
                            {field.score !== undefined && field.score > 0 && (
                              <span className="text-xs text-slate-500">
                                (Score: {field.score})
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Input Field */}
                        <div className="mt-2">
                          <input
                            type="text"
                            value={field.value || ''}
                            onChange={(e) => updateFieldValue(formIndex, fieldIndex, e.target.value)}
                            placeholder={field.placeholder !== 'no-placeholder' ? field.placeholder : `Masukkan ${displayTitle}`}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>
                        
                        {/* Metadata - Only show if not empty */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-2">
                          {field.name && field.name !== 'no-name' && (
                            <span>
                              <span className="text-slate-400">Name:</span> <span className="font-mono">{field.name}</span>
                            </span>
                          )}
                          {field.id && field.id !== 'no-id' && (
                            <span>
                              <span className="text-slate-400">ID:</span> <span className="font-mono">{field.id}</span>
                            </span>
                          )}
                          {field.autocomplete && field.autocomplete !== 'none' && field.autocomplete !== 'off' && (
                            <span>
                              <span className="text-slate-400">Autocomplete:</span> {field.autocomplete}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScanFormPanel;
