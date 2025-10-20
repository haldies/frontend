import {
  type ChangeEvent,
  type JSX,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FIELD_KEYS, type FieldKey } from '@/modules/autofill/keys';
import { createDefaultProfile } from '@/modules/autofill/config';
import type { ProfileFieldState } from '@/modules/autofill/types';
import { loadStateFromStorage, saveStateToStorage, subscribeToStateChanges } from '@/modules/autofill/storage';
import { extractProfileFromPdf } from './mockExtraction';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import UploadCard from './components/UploadCard';
import ExtractionProgressTimeline from './components/ExtractionProgressTimeline';
import ProfileSummaryCard from './components/ProfileSummaryCard';
import FieldsEditor from './components/FieldsEditor';
import type { ExtractionStatus, StatusMeta, TabId } from './types';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'fields', label: 'Kustomisasi Field' },
];

const PROGRESS_STEPS: Array<{ title: string; description: string }> = [
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

const HIGHLIGHT_KEYS: FieldKey[] = ['fullName', 'jobTitle', 'company', 'email', 'phone', 'linkedin'];

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
  const progressTimers = useRef<number[]>([]);
  const [panelOpen, setPanelOpen] = useState<boolean>(true);
  const panelOpenRef = useRef<boolean>(panelOpen);
  const profileLoadedRef = useRef<boolean>(false);
  const pendingProfileRef = useRef<Record<FieldKey, ProfileFieldState> | null>(null);

  const isProcessing = status === 'processing';
  const statusMeta = STATUS_META[status];

  const filledCount = useMemo(() => {
    return FIELD_KEYS.reduce((count, key) => {
      const value = profile[key].value.trim();
      return value.length > 0 ? count + 1 : count;
    }, 0);
  }, [profile]);

  const formattedUpdatedAt = useMemo(() => {
    return lastUpdatedAt ? formatTime(lastUpdatedAt) : null;
  }, [lastUpdatedAt]);

  const clearProgressTimers = () => {
    progressTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    progressTimers.current = [];
  };

  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  useEffect(() => {
    return () => {
      clearProgressTimers();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loaded = await loadStateFromStorage();
      if (cancelled) {
        return;
      }
      const nextProfile = pendingProfileRef.current ?? loaded.profile;
      setProfile(nextProfile);
      setPanelOpen(loaded.panelOpen);
      panelOpenRef.current = loaded.panelOpen;
      profileLoadedRef.current = true;

      if (pendingProfileRef.current) {
        const queuedProfile = pendingProfileRef.current;
        pendingProfileRef.current = null;
        void saveStateToStorage({
          panelOpen: panelOpenRef.current,
          profile: queuedProfile,
        });
      }
    })();

    const unsubscribe = subscribeToStateChanges((nextState) => {
      profileLoadedRef.current = true;
      pendingProfileRef.current = null;
      if (cancelled) {
        return;
      }
      setProfile(nextState.profile);
      setPanelOpen(nextState.panelOpen);
      panelOpenRef.current = nextState.panelOpen;
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const persistProfile = (nextProfile: Record<FieldKey, ProfileFieldState>) => {
    if (!profileLoadedRef.current) {
      pendingProfileRef.current = nextProfile;
      return;
    }

    pendingProfileRef.current = null;
    void saveStateToStorage({
      panelOpen: panelOpenRef.current,
      profile: nextProfile,
    });
  };

  const handleToggle = (key: FieldKey) => {
    setProfile((prev) => {
      const next = { ...prev };
      next[key] = { ...prev[key], enabled: !prev[key].enabled };
      persistProfile(next);
      return next;
    });
  };

  const handleValueChange = (key: FieldKey, value: string) => {
    setProfile((prev) => {
      const next = { ...prev };
      next[key] = { ...prev[key], value };
      persistProfile(next);
      return next;
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

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

    clearProgressTimers();
    setProgressStep(1);
    progressTimers.current.push(
      window.setTimeout(() => {
        setProgressStep(2);
      }, 1200),
    );
    progressTimers.current.push(
      window.setTimeout(() => {
        setProgressStep(3);
      }, 2400),
    );

    try {
      const extracted = await extractProfileFromPdf(file);
      setProfile((prev) => {
        const next = { ...prev };
        FIELD_KEYS.forEach((key) => {
          const previous = prev[key];
          const incoming = extracted[key];
          next[key] = {
            ...previous,
            value: typeof incoming === 'string' ? incoming : previous.value,
          };
        });
        persistProfile(next);
        return next;
      });
      setStatus('success');
      setProgressStep(3);
      setLastUpdatedAt(new Date());
    } catch (ex) {
      console.error('Failed to extract profile from PDF', ex);
      setStatus('error');
      setError('Terjadi kesalahan saat memproses PDF. Coba lagi.');
      setProgressStep(0);
    } finally {
      clearProgressTimers();
    }
  };

  const handleReset = () => {
    clearProgressTimers();
    const resetProfile = createEmptyProfile();
    setProfile(resetProfile);
    setStatus('idle');
    setActiveTab('overview');
    setUploadedFileName(null);
    setLastUpdatedAt(null);
    setError(null);
    setProgressStep(0);
    persistProfile(resetProfile);
  };

  return (
    <div className="flex min-h-[38rem] w-[40rem] max-w-full flex-col gap-6 border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-100 p-7 text-slate-900 shadow-[0_40px_70px_-35px_rgba(30,64,175,0.55)]">
      <Header onReset={handleReset} disabled={isProcessing && !uploadedFileName} />

      <TabNavigation tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
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
              <ExtractionProgressTimeline status={status} progressStep={progressStep} steps={PROGRESS_STEPS} />
            }
          />

          {(status === 'processing' || status === 'success') && (
            <ProfileSummaryCard
              profile={profile}
              highlightKeys={HIGHLIGHT_KEYS}
              onEditClick={() => setActiveTab('fields')}
            />
          )}
        </section>
      ) : (
        <FieldsEditor profile={profile} onToggle={handleToggle} onValueChange={handleValueChange} />
      )}
    </div>
  );
}

export default App;
