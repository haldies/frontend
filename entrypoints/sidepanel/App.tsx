import {
  type ChangeEvent,
  type JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FieldKey } from '@/modules/autofill/types/keys';
import {
  createDefaultProfile,
  ensureFieldConfigsReady,
  getFieldConfigKeysSync,
  subscribeToFieldConfigChanges,
} from '@/modules/autofill/core/config';
import type { AutoFillState, ProfileFieldState } from '@/modules/autofill/types/types';
import type { ExtractionStatus, StatusMeta, TabId } from './types';

import {
  loadStateFromStorage,
  saveStateToStorage,
  subscribeToStateChanges,
  subscribeToStateMessages,
} from '@/modules/autofill/storage/storage';

import { extractProfileFromPdf } from './mockExtraction';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import UploadCard from './components/UploadCard';
import ExtractionProgressTimeline from './components/ExtractionProgressTimeline';
import ChatbotPanel from './components/ChatbotPanel';
import FieldForm from './components/FieldForm';
import ScanFormPanel from './components/ScanFormPanel';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'fields', label: 'Fields' },
  { id: 'chatbot', label: 'Chatbot' },
  { id: 'scanForm', label: 'Scan Form' },
  { id: 'profile', label: 'Profile' },
] as const;

const PROGRESS_STEPS = [
  {
    title: 'Mengunggah PDF',
    description: 'Memeriksa format dan mengamankan file sebelum pemrosesan.',
  },
  {
    title: 'Mengekstrak Data',
    description: 'AI membaca konten dan mendeteksi informasi profil penting.',
  },
  {
    title: 'Merapikan Profil',
    description: 'Menyusun hasil ekstraksi agar siap diisi ke formulir.',
  },
];

const HIGHLIGHT_KEYS: FieldKey[] = [
  'fullName',
  'jobTitle',
  'company',
  'email',
  'phone',
  'linkedin',
];

const STATUS_META: Record<ExtractionStatus, StatusMeta> = {
  idle: {
    label: 'Menunggu PDF',
    tone: 'border-slate-200 bg-slate-100 text-slate-600',
    highlight: 'text-slate-500',
  },
  processing: {
    label: 'Sedang memproses',
    tone: 'border-sky-300 bg-sky-100 text-sky-700',
    highlight: 'text-sky-600',
  },
  success: {
    label: 'Ekstraksi berhasil',
    tone: 'border-emerald-300 bg-emerald-100 text-emerald-700',
    highlight: 'text-emerald-600',
  },
  error: {
    label: 'Gagal memproses',
    tone: 'border-rose-300 bg-rose-100 text-rose-700',
    highlight: 'text-rose-600',
  },
};

function createEmptyProfile(): Record<string, ProfileFieldState> {
  const base = createDefaultProfile();
  getFieldConfigKeysSync().forEach((key) => {
    base[key] = { ...base[key], value: '' };
  });
  return base;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function App(): JSX.Element {
  const [fieldKeys, setFieldKeys] = useState<string[]>(() => getFieldConfigKeysSync());
  const [profile, setProfile] = useState<Record<string, ProfileFieldState>>(createEmptyProfile);
  const [status, setStatus] = useState<ExtractionStatus>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [progressStep, setProgressStep] = useState<number>(0);
  const progressTimers = useRef<number[]>([]);

  const isProcessing = status === 'processing';
  const statusMeta = STATUS_META[status];

  const filledCount = useMemo(() => {
    return fieldKeys.reduce((count, key) => {
      const value = profile[key]?.value.trim() ?? '';
      return value.length > 0 ? count + 1 : count;
    }, 0);
  }, [profile, fieldKeys]);

  const formattedUpdatedAt = useMemo(() => {
    return lastUpdatedAt ? formatTime(lastUpdatedAt) : null;
  }, [lastUpdatedAt]);

  const applyExternalState = useCallback(
    (nextState: AutoFillState) => {
      setProfile(nextState.profile);
      const keys = getFieldConfigKeysSync();
      const hasValue = keys.some((key) => nextState.profile[key]?.value?.trim());
      if (hasValue) {
        setStatus((prev) => (prev === 'idle' ? 'success' : prev));
        setLastUpdatedAt(new Date());
      }
    },
    [setLastUpdatedAt, setProfile, setStatus],
  );

  const persistProfile = useCallback(
    (next: Record<string, ProfileFieldState>) => {
      void saveStateToStorage({
        panelOpen: true,
        profile: next,
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void ensureFieldConfigsReady()
      .then(() => {
        if (!cancelled) {
          setFieldKeys(getFieldConfigKeysSync());
        }
      })
      .catch((error) => {
        console.warn('Smart Autofill: gagal memuat konfigurasi field', error);
      });

    const unsubscribe = subscribeToFieldConfigChanges(({ configs, keys }) => {
      if (cancelled) {
        return;
      }
      setFieldKeys(keys);
      let profileToPersist: Record<string, ProfileFieldState> | null = null;
      setProfile((prev) => {
        const next = {} as Record<string, ProfileFieldState>;
        let changed = Object.keys(prev).length !== keys.length;
        keys.forEach((key) => {
          const definition = configs[key];
          if (!definition) {
            return;
          }
          const existing = prev[key];
          if (existing) {
            next[key] = {
              ...existing,
              key,
              label: definition.label,
              placeholder: definition.placeholder || '',
              description: definition.description,
              inputKind: definition.inputKind,
            };
          } else {
            changed = true;
            next[key] = {
              key,
              label: definition.label,
              placeholder: definition.placeholder || '',
              description: definition.description,
              value: definition.defaultValue ?? '',
              enabled: definition.defaultEnabled,
              inputKind: definition.inputKind,
            };
          }
        });
        profileToPersist = changed ? next : null;
        return next;
      });
      if (profileToPersist) {
        persistProfile(profileToPersist);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [persistProfile]);

  useEffect(() => {
    let cancelled = false;

    const applyIfActive = (next: AutoFillState) => {
      if (!cancelled) {
        applyExternalState(next);
      }
    };

    void loadStateFromStorage()
      .then((initialState) => {
        applyIfActive(initialState);
      })
      .catch((error) => {
        console.warn('Smart Autofill sidepanel: gagal memuat data awal', error);
      });

    const unsubscribes = [
      subscribeToStateChanges(applyIfActive),
      subscribeToStateMessages(applyIfActive),
    ];

    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch {
        }
      });
    };
  }, [applyExternalState]);
  const handleValueChange = (key: string, value: string) => {
    setProfile((prev) => {
      const next = { ...prev, [key]: { ...prev[key], value } };
      persistProfile(next);
      return next;
    });
    setLastUpdatedAt(new Date());
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('error');
      setError('Format file harus PDF (.pdf).');
      setProgressStep(0);
      return;
    }

    setActiveTab('overview');
    setStatus('processing');
    setError(null);
    setUploadedFileName(file.name);
    setLastUpdatedAt(null);

    setProgressStep(1);
    setTimeout(() => setProgressStep(2), 1200);
    setTimeout(() => setProgressStep(3), 2400);

    try {
      const extracted = await extractProfileFromPdf(file);
      setProfile((prev) => {
        const next = { ...prev };
        fieldKeys.forEach((key) => {
          next[key] = { ...prev[key], value: extracted[key] || prev[key].value };
        });
        persistProfile(next);
        return next;
      });
      setStatus('success');
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError('Terjadi kesalahan saat memproses PDF.');
    }
  };

  const handleReset = () => {
    const resetProfile = createEmptyProfile();
    setProfile(resetProfile);
    setStatus('idle');
    setUploadedFileName(null);
    setLastUpdatedAt(null);
    setError(null);
    setProgressStep(0);
    persistProfile(resetProfile);
  };

  let tabContent: JSX.Element;
  switch (activeTab) {
    case 'overview':
      tabContent = (
        <section className="flex flex-col gap-5">
          <UploadCard
            status={status}
            statusMeta={statusMeta}
            isProcessing={isProcessing}
            uploadedFileName={uploadedFileName}
            formattedUpdatedAt={formattedUpdatedAt}
            filledCount={filledCount}
            totalFields={fieldKeys.length}
            error={error}
            onFileChange={handleFileChange}
            progressTimeline={
              <ExtractionProgressTimeline
                status={status}
                progressStep={progressStep}
                steps={PROGRESS_STEPS}
              />
            }
          />
        </section>
      );
      break;

    case 'fields':
      tabContent =  <FieldForm/>;
      break;

    case 'chatbot':
      tabContent = (
        <ChatbotPanel
          profile={profile}
          status={status}
          highlightKeys={HIGHLIGHT_KEYS}
          filledCount={filledCount}
          totalFields={fieldKeys.length}
          onEditProfile={() => setActiveTab('fields')}
        />
      );
      break;

    case 'scanForm':
      tabContent = <ScanFormPanel />;
      break;

    default:
      tabContent = <div>Tab tidak ditemukan</div>;
  }

  const tabWrapperClassName =
    activeTab === 'chatbot' || activeTab === 'scanForm'
      ? 'flex flex-1 min-h-0'
      : 'flex-1 min-h-0 overflow-y-auto pr-1';

  return (
    <div className="flex h-screen max-w-full flex-col gap-6 overflow-hidden border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-100 pt-7 pb-7 pl-7 text-slate-900 shadow-[0_40px_70px_-35px_rgba(30,64,175,0.55)]">
      <Header onReset={handleReset} disabled={isProcessing && !!uploadedFileName} />
      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className={tabWrapperClassName}>{tabContent}</div>
        <TabNavigation tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
}

export default App;
