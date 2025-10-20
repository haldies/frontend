import { SmartAutofillController } from '../modules/autofill/index.ts';

declare global {
  interface Window {
    __smartAutofillController__?: SmartAutofillController;
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    if (window.top && window !== window.top) {
      return;
    }

    if (window.__smartAutofillController__) {
      return;
    }

    const controller = new SmartAutofillController();
    window.__smartAutofillController__ = controller;
    void controller.start();
  },
});
