// Service Worker — Captura full-page via scroll + captureVisibleTab + costura com OffscreenCanvas

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'capture_screenshot') {
        captureFullPage()
            .then(result  => sendResponse({ ok: true,  ...result }))
            .catch(err    => sendResponse({ ok: false, error: err.message }));
        return true; // mantém canal assíncrono aberto
    }
});

async function captureFullPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('Nenhuma aba ativa encontrada.');

    // 1. Coleta dimensões e DPR da página
    const [{ result: dims }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
            scrollHeight:   Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
            viewportWidth:  window.innerWidth,
            viewportHeight: window.innerHeight,
            dpr:            window.devicePixelRatio || 1,
            title:          document.title,
            url:            window.location.href
        })
    });

    const screenshots = [];
    let requestedY = 0;

    // 2. Loop de scroll + captura
    while (requestedY < dims.scrollHeight) {
        const [{ result: actualY }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: y => { window.scrollTo(0, y); return window.scrollY; },
            args: [requestedY]
        });

        // Página não consegue mais rolar (atingiu o fim)
        if (screenshots.length > 0 && actualY === screenshots[screenshots.length - 1].scrollY) break;

        // Aguarda renderização de animações
        await new Promise(r => setTimeout(r, 400));

        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        screenshots.push({ dataUrl, scrollY: actualY });
        requestedY += dims.viewportHeight;
    }

    // 3. Restaura o scroll original
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo(0, 0)
    });

    // 4. Costura os screenshots com OffscreenCanvas
    const canvas = new OffscreenCanvas(dims.viewportWidth, dims.scrollHeight);
    const ctx = canvas.getContext('2d');

    for (const shot of screenshots) {
        const resp   = await fetch(shot.dataUrl);
        const blob   = await resp.blob();
        const bitmap = await createImageBitmap(blob);

        // Converte pixels físicos → pixels CSS para posicionamento correto
        const cssH = bitmap.height / dims.dpr;
        ctx.drawImage(bitmap,
            0, 0, bitmap.width, bitmap.height,       // src: imagem completa (físico)
            0, shot.scrollY, dims.viewportWidth, cssH // dst: posição CSS no canvas
        );
        bitmap.close();
    }

    // 5. Exporta PNG e dispara download
    const pngBlob  = await canvas.convertToBlob({ type: 'image/png' });
    const arrayBuf = await pngBlob.arrayBuffer();
    const bytes    = new Uint8Array(arrayBuf);

    // Codifica base64 em chunks (evita stack overflow em páginas grandes)
    const CHUNK = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    const dataURL  = 'data:image/png;base64,' + btoa(binary);
    const slug     = (dims.title || 'page').replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    const filename = 'html2figma_' + slug + '_' + Date.now() + '.png';

    await chrome.downloads.download({ url: dataURL, filename: filename, saveAs: false });

    return {
        filename,
        width:  dims.viewportWidth,
        height: dims.scrollHeight
    };
}
