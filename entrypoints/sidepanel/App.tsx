import {
  type ChangeEvent,
  type JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FIELD_KEYS, type FieldKey } from '@/modules/autofill/keys';
import { createDefaultProfile } from '@/modules/autofill/config';
import type { AutoFillState, ProfileFieldState } from '@/modules/autofill/types';
import {
  loadStateFromStorage,
  saveStateToStorage,
  subscribeToStateChanges,
  subscribeToStateMessages,
} from '@/modules/autofill/storage';
import { extractProfileFromPdf } from './mockExtraction';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import UploadCard from './components/UploadCard';
import ExtractionProgressTimeline from './components/ExtractionProgressTimeline';
import ChatbotPanel from './components/ChatbotPanel';
import type { ExtractionStatus, StatusMeta, TabId } from './types';
import ProfilePanel from './components/ProfileSummaryCard';
import {
  ensureProfilePayload,
  getCachedProfilePayload,
} from '@/modules/autofill/api';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'fields', label: 'Kustomisasi Field' },
  { id: 'chatbot', label: 'Chatbot AI' },
];

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

function createEmptyProfile(): Record<FieldKey, ProfileFieldState> {
  const base = createDefaultProfile();
  FIELD_KEYS.forEach((key) => {
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
  const [profile, setProfile] = useState<Record<FieldKey, ProfileFieldState>>(createEmptyProfile);
  const [status, setStatus] = useState<ExtractionStatus>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [progressStep, setProgressStep] = useState<number>(0);
  const [profilePayload, setProfilePayload] = useState<Record<string, unknown> | null>(
    () => getCachedProfilePayload(),
  );
  const progressTimers = useRef<number[]>([]);

  const isProcessing = status === 'processing';
  const statusMeta = STATUS_META[status];

  const filledCount = useMemo(() => {
    return FIELD_KEYS.reduce((count, key) => {
      const value = profile[key]?.value.trim() ?? '';
      return value.length > 0 ? count + 1 : count;
    }, 0);
  }, [profile]);

  const formattedUpdatedAt = useMemo(() => {
    return lastUpdatedAt ? formatTime(lastUpdatedAt) : null;
  }, [lastUpdatedAt]);

  const summaryProfile = useMemo(() => {
    const base: Record<string, unknown> = profilePayload ? { ...profilePayload } : {};

    FIELD_KEYS.forEach((key) => {
      const current = profile[key]?.value;
      if (typeof current !== 'undefined' && current !== null) {
        base[key] = current;
      }
    });

    return base;
  }, [profile, profilePayload]);

  const applyExternalState = useCallback(
    (nextState: AutoFillState) => {
      setProfile(nextState.profile);
      const hasValue = FIELD_KEYS.some((key) => nextState.profile[key]?.value?.trim());
      if (hasValue) {
        setStatus((prev) => (prev === 'idle' ? 'success' : prev));
        setLastUpdatedAt(new Date());
      }
    },
    [setLastUpdatedAt, setProfile, setStatus],
  );

  useEffect(() => {
    let active = true;
    void ensureProfilePayload()
      .then((payload) => {
        if (active) {
          setProfilePayload(payload);
        }
      })
      .catch(() => {
        if (active) {
          setProfilePayload(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
          // ignore unsubscribe errors
        }
      });
    };
  }, [applyExternalState]);

  const persistProfile = (next: Record<FieldKey, ProfileFieldState>) => {
    void saveStateToStorage({ panelOpen: true, profile: next });
  };

  const handleValueChange = (key: FieldKey, value: string) => {
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
        FIELD_KEYS.forEach((key) => {
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

  // 🧭 Tab handler
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
            totalFields={FIELD_KEYS.length}
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
      tabContent = (
        <ProfilePanel
          profile={summaryProfile}
        />
      );
      break;

    case 'chatbot':
      tabContent = (
        <ChatbotPanel
          profile={profile}
          status={status}
          highlightKeys={HIGHLIGHT_KEYS}
          filledCount={filledCount}
          totalFields={FIELD_KEYS.length}
          onEditProfile={() => setActiveTab('fields')}
        />
      );
      break;

    default:
      tabContent = <div>Tab tidak ditemukan</div>;
  }

  const tabWrapperClassName =
    activeTab === 'chatbot'
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
