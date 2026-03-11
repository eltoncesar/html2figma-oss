import { htmlToFigma } from '@builder.io/html-to-figma';

(async function () {
    try {
        chrome.runtime.sendMessage({ action: 'capture_start' });

        var result = await htmlToFigma(document.body, { useFrames: true });

        // A lib retorna { layers: [...] } ou diretamente um array
        var layers = Array.isArray(result) ? result : (result.layers || [result]);

        var payload = {
            layers: layers,
            meta: {
                url:        window.location.href,
                title:      document.title,
                width:      window.innerWidth,
                height:     Math.max(document.body.scrollHeight, window.innerHeight),
                capturedAt: new Date().toISOString()
            }
        };

        var json     = JSON.stringify(payload, null, 2);
        var blob     = new Blob([json], { type: 'application/json' });
        var url      = URL.createObjectURL(blob);
        var slug     = window.location.hostname.replace(/\./g, '_') || 'localhost';
        var filename = 'html2figma_' + slug + '_' + Date.now() + '.json';

        var a      = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        chrome.runtime.sendMessage({ action: 'capture_done', filename: filename });
    } catch (err) {
        chrome.runtime.sendMessage({ action: 'capture_error', error: err.message });
    }
})();
