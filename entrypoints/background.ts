// entrypoints/background.ts

type ChromeGlobal = typeof globalThis & { chrome?: any };

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  const chromeApi = (globalThis as ChromeGlobal).chrome;
  if (!chromeApi?.runtime?.onInstalled || !chromeApi?.sidePanel?.setPanelBehavior) {
    console.warn('Chrome side panel API not available in this context.');
    return;
  }

  // PENTING: Gunakan chrome.runtime.onInstalled agar kode ini berjalan saat ekstensi pertama kali dipasang
  // dan diupdate, memastikan pengaturan panel samping selalu diterapkan.
  chromeApi.runtime.onInstalled.addListener(() => {
    // Mengatur perilaku ekstensi: ketika ikon 'Action' (ikon toolbar) diklik,
    // panel samping akan terbuka.
    chromeApi.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    })
    .then(() => {
      console.log('Side Panel Behavior berhasil diatur: openPanelOnActionClick: true');
    })
    .catch((error: unknown) => {
      console.error('Gagal mengatur Side Panel Behavior:', error);
    });
  });

  // Jika Anda memiliki logika Service Worker lain, Anda bisa menambahkannya di sini.
});
