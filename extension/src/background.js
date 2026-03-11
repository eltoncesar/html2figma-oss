// Service Worker (Manifest V3)
// Recebe mensagem do popup e injeta o content script na aba ativa

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'capture') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) {
                sendResponse({ error: 'Nenhuma aba ativa encontrada.' });
                return;
            }

            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['dist/content.bundle.js']
                });
                sendResponse({ ok: true });
            } catch (err) {
                sendResponse({ error: err.message });
            }
        });

        // Retorna true para manter o canal de resposta aberto (async)
        return true;
    }
});
