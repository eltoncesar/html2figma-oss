// Lógica do popup da extensão — modo screenshot

const btnCapture = document.getElementById('btnCapture');
const statusEl   = document.getElementById('status');
const urlEl      = document.getElementById('currentUrl');

// Exibe a URL da aba ativa
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    urlEl.textContent = tabs[0] ? tabs[0].url : '—';
});

// Clique no botão de captura
btnCapture.addEventListener('click', () => {
    btnCapture.disabled = true;
    setStatus('Capturando página... não feche esta janela', 'loading');

    chrome.runtime.sendMessage({ action: 'capture_screenshot' }, (response) => {
        if (chrome.runtime.lastError) {
            setStatus('Erro: ' + chrome.runtime.lastError.message, 'error');
            btnCapture.disabled = false;
            return;
        }

        if (!response || !response.ok) {
            setStatus('Erro: ' + (response ? response.error : 'sem resposta'), 'error');
            btnCapture.disabled = false;
            return;
        }

        setStatus('✓ ' + response.filename + ' baixado!', 'success');
        btnCapture.disabled = false;
        btnCapture.innerHTML = '<span>⬡</span> Capturar novamente';
    });
});

function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (type ? ' ' + type : '');
}
