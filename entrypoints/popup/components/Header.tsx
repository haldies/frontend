import type { JSX } from 'react';

interface HeaderProps {
  onReset: () => void;
  disabled: boolean;
}

const Header = ({ onReset, disabled }: HeaderProps): JSX.Element => {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-600 shadow-sm">
            Smart Autofill
          </span>
          <h1 className="text-2xl font-semibold text-slate-900">Profil Profesional Instan</h1>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-sky-400 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset
        </button>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">
        Unggah CV atau resume berformat PDF untuk diubah menjadi profil autofill yang siap digunakan pada berbagai
        formulir pendaftaran kerja.
      </p>
    </header>
  );
};

export default Header;
