import type { JSX } from 'react';
import type { ExtractionStatus } from '../types';

interface ProgressStep {
  title: string;
  description: string;
}

interface ExtractionProgressTimelineProps {
  status: ExtractionStatus;
  progressStep: number;
  steps: ProgressStep[];
}

const ExtractionProgressTimeline = ({
  status,
  progressStep,
  steps,
}: ExtractionProgressTimelineProps): JSX.Element | null => {
  if (progressStep === 0 && status === 'idle') {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Proses ekstraksi</h3>
        <p className="mt-1 text-xs text-slate-400">
          Pantau langkah demi langkah sampai profil kamu siap digunakan.
        </p>
      </div>
      <div className="space-y-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = status === 'success' && progressStep >= stepNumber;
          const isActive = status === 'processing' && progressStep === stepNumber;
          const indicatorClass = isCompleted
            ? 'bg-emerald-500 text-white'
            : isActive
            ? 'bg-sky-500 text-white animate-pulse'
            : 'bg-slate-200 text-slate-500';

          const connectorClass =
            status === 'success' && progressStep > stepNumber
              ? 'bg-emerald-300'
              : status === 'processing' && progressStep > stepNumber
              ? 'bg-sky-300'
              : 'bg-slate-200';

          return (
            <div key={step.title} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${indicatorClass}`}
                >
                  {isCompleted ? 'OK' : stepNumber}
                </span>
                {index < steps.length - 1 && (
                  <span className={`mt-1 h-8 w-[2px] rounded-full ${connectorClass}`} />
                )}
              </div>
              <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="mt-1 text-xs text-slate-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExtractionProgressTimeline;
