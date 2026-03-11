// Content script — roda no contexto da página capturada
// Usa @builder.io/html-to-figma para converter o DOM em JSON compatível com Figma

import { htmlToFigma } from '@builder.io/html-to-figma';

(async () => {
    try {
        // Notifica o popup que a captura começou
        chrome.runtime.sendMessage({ action: 'capture_start' });

        // Converte o body da página em nós Figma
        const layers = await htmlToFigma(document.body, {
            useFrames: true,
            time: true
        });

        const payload = {
            layers,
            meta: {
                url: window.location.href,
                title: document.title,
                width: window.innerWidth,
                capturedAt: new Date().toISOString()
            }
        };

        // Serializa e faz download do arquivo JSON
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Gera nome de arquivo a partir da URL da página
        const slug = window.location.hostname.replace(/\./g, '_');
        const filename = `html2figma_${slug}_${Date.now()}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        chrome.runtime.sendMessage({ action: 'capture_done', filename });
    } catch (err) {
        chrome.runtime.sendMessage({ action: 'capture_error', error: err.message });
    }
})();
