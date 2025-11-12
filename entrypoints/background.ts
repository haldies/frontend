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

  // Message handler untuk komunikasi antara sidepanel dan content script
  chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Background received message:', message);
    console.log('📨 Message action:', message.action);
    console.log('📨 Sender tab:', sender.tab?.id);

    if (message.action === 'sendMessageToContentScript') {
      console.log('🎯 Forwarding message to content script...');

      // Teruskan pesan ke content script di tab aktif
      chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        console.log('📋 Found tabs:', tabs.length);

        if (tabs && tabs[0]) {
          const tabId = tabs[0].id;
          console.log('📤 Sending message to tab:', tabId);
          console.log('📤 Message content:', message.message);

          chromeApi.tabs.sendMessage(tabId, message.message, (response: any) => {
            if (chromeApi.runtime.lastError) {
              console.error('❌ Error sending message to content script:', chromeApi.runtime.lastError);
              console.error('❌ Tab ID:', tabId);
              console.error('❌ Message:', message.message);
              sendResponse({ success: false, error: chromeApi.runtime.lastError.message });
            } else {
              console.log('✅ Response from content script:', response);
              sendResponse({ success: true, response });
            }
          });
        } else {
          console.error('❌ No active tab found');
          console.error('❌ Available tabs:', tabs);
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });

      // Return true untuk async response
      return true;
    }

    // Default response untuk pesan lain
    console.log('❓ Unknown message action:', message.action);
    sendResponse({ success: false, error: 'Unknown action' });
    return true;
  });

  // Jika Anda memiliki logika Service Worker lain, Anda bisa menambahkannya di sini.
});
