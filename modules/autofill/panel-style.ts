const PANEL_STYLES = `
  :host {
    all: initial;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  .saf-wrapper {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    width: 100%;
    height: auto;
  }

  .saf-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(320px, calc(100vw - 24px));
    margin: 16px;
    padding-bottom: 16px;
    color: #f8fafc;
    background: linear-gradient(145deg, rgba(31, 41, 55, 0.92), rgba(17, 24, 39, 0.94));
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 18px;
    box-shadow: 0 28px 60px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(148, 163, 184, 0.1);
    backdrop-filter: blur(16px);
    transform: translateX(0);
    transition: transform 260ms ease, opacity 260ms ease;
  }

  .saf-wrapper[data-open="false"] .saf-panel {
    transform: translateX(calc(-100%));
    opacity: 0.88;
  }

  .saf-toggle-handle {
    position: absolute;
    top: 18px;
    right: -42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    background: #38bdf8;
    border: none;
    border-radius: 0 12px 12px 0;
    cursor: pointer;
    box-shadow: 8px 12px 24px rgba(15, 23, 42, 0.4);
    transition: transform 200ms ease, background 200ms ease;
  }

  .saf-wrapper[data-open="false"] .saf-toggle-handle {
    background: #0ea5e9;
  }

  .saf-toggle-handle:focus-visible {
    outline: 2px solid #f1f5f9;
    outline-offset: 2px;
  }

  .saf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 20px 8px;
  }

  .saf-title-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .saf-title {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .saf-subtitle {
    font-size: 12px;
    color: rgba(226, 232, 240, 0.68);
    line-height: 1.4;
  }

  .saf-chip {
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #0f172a;
    background: linear-gradient(135deg, #38bdf8, #818cf8);
    border-radius: 999px;
  }

  .saf-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 0 20px;
    max-height: min(70vh, 520px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
  }

  .saf-body::-webkit-scrollbar {
    width: 6px;
  }

  .saf-body::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.35);
    border-radius: 999px;
  }

  .saf-field {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 16px;
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.2);
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }

  .saf-field[data-ready="true"] {
    border-color: rgba(74, 222, 128, 0.55);
    background: rgba(22, 101, 52, 0.28);
  }

  .saf-field-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .saf-field-heading {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .saf-field-label {
    font-size: 14px;
    font-weight: 600;
  }

  .saf-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 999px;
    letter-spacing: 0.02em;
  }

  .saf-badge--ready {
    background: rgba(74, 222, 128, 0.12);
    color: #4ade80;
  }

  .saf-badge--missing {
    background: rgba(148, 163, 184, 0.12);
    color: rgba(226, 232, 240, 0.75);
  }

  .saf-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 48px;
    height: 26px;
  }

  .saf-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .saf-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: rgba(148, 163, 184, 0.38);
    border-radius: 999px;
    transition: background 180ms ease;
  }

  .saf-slider::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 4px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #0f172a;
    transition: transform 180ms ease, background 180ms ease;
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.35);
  }

  .saf-switch input:checked + .saf-slider {
    background: rgba(56, 189, 248, 0.8);
  }

  .saf-switch input:checked + .saf-slider::before {
    transform: translateX(20px);
    background: #f8fafc;
  }

  .saf-input {
    width: 100%;
    padding: 12px;
    font-size: 13px;
    color: #0f172a;
    background: rgba(248, 250, 252, 0.92);
    border: none;
    border-radius: 12px;
    transition: box-shadow 180ms ease, transform 180ms ease;
  }

  .saf-input:focus {
    outline: 0;
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.6);
    transform: translateY(-1px);
  }

  .saf-input:disabled {
    color: rgba(30, 41, 59, 0.6);
    background: rgba(241, 245, 249, 0.55);
    cursor: not-allowed;
  }

  .saf-input--multiline {
    min-height: 72px;
    resize: vertical;
  }

  .saf-helper {
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
    color: rgba(226, 232, 240, 0.75);
  }

  .saf-apply {
    margin-top: 4px;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    background: linear-gradient(135deg, #38bdf8, #22d3ee);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .saf-apply:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(56, 189, 248, 0.25);
  }

  .saf-apply[data-state="success"] {
    background: linear-gradient(135deg, #4ade80, #22c55e);
    color: #0f172a;
  }

  .saf-footer {
    padding: 0 20px;
  }

  .saf-tip {
    margin: 8px 0 0;
    font-size: 11px;
    color: rgba(148, 163, 184, 0.92);
    line-height: 1.5;
  }

  @media (max-width: 680px) {
    .saf-panel {
      width: min(92vw, 320px);
      margin: 12px;
    }

    .saf-toggle-handle {
      right: -36px;
    }
  }
`;

export default PANEL_STYLES;
