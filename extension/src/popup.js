// Lógica do popup da extensão

const btnCapture = document.getElementById('btnCapture');
const statusEl   = document.getElementById('status');
const urlEl      = document.getElementById('currentUrl');

// Exibe a URL da aba ativa
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    urlEl.textContent = tabs[0]?.url || '—';
});

// Escuta mensagens vindas do content script
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'capture_start') {
        setStatus('Capturando página...', 'loading');
    }

    if (message.action === 'capture_done') {
        setStatus(`✓ Arquivo gerado: ${message.filename}`, 'success');
        btnCapture.disabled = false;
        btnCapture.innerHTML = '<span>⬡</span> Capturar novamente';
    }

    if (message.action === 'capture_error') {
        setStatus(`Erro: ${message.error}`, 'error');
        btnCapture.disabled = false;
    }
});

// Clique no botão de captura
btnCapture.addEventListener('click', () => {
    btnCapture.disabled = true;
    setStatus('Iniciando captura...', 'loading');

    chrome.runtime.sendMessage({ action: 'capture' }, (response) => {
        if (chrome.runtime.lastError || response?.error) {
            const msg = chrome.runtime.lastError?.message || response?.error;
            setStatus(`Erro: ${msg}`, 'error');
            btnCapture.disabled = false;
        }
    });
});

function setStatus(text, type = '') {
    statusEl.textContent = text;
    statusEl.className = `status ${type}`;
}
