// Helper untuk komunikasi antara sidepanel dan content script

export async function sendMessageToContentScript<T = any>(message: any): Promise<T | null> {
  try {
    console.log('📤 Sending message to content script via background:', message);

    // Kirim pesan ke background script, yang akan meneruskan ke content script
    const response = await chrome.runtime.sendMessage({
      action: 'sendMessageToContentScript',
      message: message
    });

    console.log('📥 Received response from background:', response);

    if (response && response.success) {
      return response.response;
    } else {
      console.error('❌ Background script reported error:', response?.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to send message to content script:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

export async function triggerDetectionFromSidepanel(): Promise<boolean> {
  console.log('📤 Sending detection trigger request from sidepanel...');

  const response = await sendMessageToContentScript({
    type: 'smart-autofill:sidepanel-trigger-detection'
  });

  if (response) {
    console.log('✅ Detection trigger response received:', response);
    return true;
  } else {
    console.error('❌ No response from content script');
    return false;
  }
}

export async function triggerConfigRefresh(): Promise<boolean> {
  console.log('📤 Sending config refresh request from sidepanel...');

  const response = await sendMessageToContentScript({
    type: 'smart-autofill:refresh-config'
  });

  if (response) {
    console.log('✅ Config refresh response received:', response);
    return true;
  } else {
    console.error('❌ No response from content script for config refresh');
    return false;
  }
}