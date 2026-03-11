// content.js v4
// Fase 1: estrutura (FRAME/RECTANGLE) via DOM recursivo
// Fase 2: texto via TreeWalker (posição pixel-exata por createRange)

(function () {
    var SKIP_TAGS = { SCRIPT:1, STYLE:1, NOSCRIPT:1, HEAD:1, META:1, LINK:1, TITLE:1, TEMPLATE:1 };
    var MAX_DEPTH = 30;

    // ── Helpers ──────────────────────────────────────────────────────────────

    function getRgb(str) {
        if (!str) return null;
        str = str.trim();
        if (str === 'transparent' || str === 'none' || str === '') return null;
        var m = str.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        var a = m[4] !== undefined ? parseFloat(m[4]) : 1;
        if (a < 0.02) return null; // totalmente transparente
        return { r: parseFloat(m[1]) / 255, g: parseFloat(m[2]) / 255, b: parseFloat(m[3]) / 255 };
    }

    function pf(v) { return parseFloat(v) || 0; }

    function isHidden(el) {
        var cs = window.getComputedStyle(el);
        return cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.01;
    }

    // ── Fase 1: captura frames ────────────────────────────────────────────────

    function captureFrame(el, depth, sx, sy) {
        if (!el || el.nodeType !== 1) return null;
        if (SKIP_TAGS[el.tagName]) return null;
        if (depth > MAX_DEPTH) return null;
        if (isHidden(el)) return null;

        var rect = el.getBoundingClientRect();
        var w = Math.round(rect.width);
        var h = Math.round(rect.height);
        if (w < 1 || h < 1) return null;

        var x  = Math.round(rect.left + sx);
        var y  = Math.round(rect.top  + sy);
        var cs = window.getComputedStyle(el);
        var tag = el.tagName.toUpperCase();

        // SVG → retângulo com cor do ícone
        if (tag === 'SVG') {
            var iconColor = getRgb(cs.color) || { r: 0.4, g: 0.4, b: 0.4 };
            return { type: 'RECTANGLE', name: 'icon',
                x: x, y: y, width: w, height: h,
                fills: [{ type: 'SOLID', color: iconColor }],
                topLeftRadius: 2, topRightRadius: 2, bottomRightRadius: 2, bottomLeftRadius: 2 };
        }

        // IMG → retângulo cinza placeholder
        if (tag === 'IMG') {
            return { type: 'RECTANGLE', name: el.alt || 'image',
                x: x, y: y, width: w, height: h,
                fills: [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }],
                topLeftRadius: 0, topRightRadius: 0, bottomRightRadius: 0, bottomLeftRadius: 0 };
        }

        // FRAME genérico
        var className = el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/)[0] : '';
        var node = {
            type: 'FRAME',
            name: tag.toLowerCase() + (el.id ? '#' + el.id : className),
            x: x, y: y, width: w, height: h,
            clipsContent: cs.overflow === 'hidden' || cs.overflow === 'clip',
            backgrounds: [],
            children: [],
            constraints: { horizontal: 'SCALE', vertical: 'MIN' }
        };

        // Cor de fundo — background-color
        var bgColor = getRgb(cs.backgroundColor);
        if (bgColor) {
            node.backgrounds = [{ type: 'SOLID', color: bgColor }];
        } else {
            // Fallback: gradient → extrai a primeira cor como sólido aproximado
            var bg = cs.background || '';
            if (bg.indexOf('gradient') !== -1) {
                var gm = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
                if (gm) node.backgrounds = [{ type: 'SOLID', color: {
                    r: parseFloat(gm[1]) / 255,
                    g: parseFloat(gm[2]) / 255,
                    b: parseFloat(gm[3]) / 255
                }}];
            }
        }

        // Border radius
        node.topLeftRadius     = pf(cs.borderTopLeftRadius);
        node.topRightRadius    = pf(cs.borderTopRightRadius);
        node.bottomRightRadius = pf(cs.borderBottomRightRadius);
        node.bottomLeftRadius  = pf(cs.borderBottomLeftRadius);

        // Opacidade
        var op = parseFloat(cs.opacity);
        if (!isNaN(op) && op < 1) node.opacity = op;

        // Borda — verifica todos os 4 lados, prioriza o mais significativo
        var bColor = getRgb(cs.borderBottomColor) || getRgb(cs.borderTopColor) || getRgb(cs.borderColor);
        var bWidth = pf(cs.borderBottomWidth) || pf(cs.borderTopWidth) || pf(cs.borderWidth);
        if (bColor && bWidth > 0.3) {
            node.strokes      = [{ type: 'SOLID', color: bColor }];
            node.strokeWeight = bWidth;
            node.strokeAlign  = 'INSIDE';
        }

        // Box shadow → passa raw para o plugin parsear
        var shadow = cs.boxShadow;
        if (shadow && shadow !== 'none') {
            node.boxShadow = shadow;
        }

        // Filhos (apenas elementos — texto é capturado na Fase 2)
        for (var i = 0; i < el.children.length; i++) {
            var child = captureFrame(el.children[i], depth + 1, sx, sy);
            if (child) node.children.push(child);
        }

        return node;
    }

    // ── Fase 2: captura textos via TreeWalker ─────────────────────────────────

    function captureTexts(root, sx, sy) {
        var texts = [];
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var tn;

        while ((tn = walker.nextNode())) {
            var content = (tn.textContent || '').trim();
            if (!content) continue;

            var parent = tn.parentElement;
            if (!parent) continue;

            // Pula se pai está oculto
            var pcs = window.getComputedStyle(parent);
            if (pcs.display === 'none' || pcs.visibility === 'hidden') continue;
            if (parseFloat(pcs.opacity) < 0.01) continue;
            if (SKIP_TAGS[parent.tagName]) continue;

            // Posição pixel-exata via Range
            var range = document.createRange();
            try { range.selectNode(tn); } catch (e) { continue; }
            var r = range.getBoundingClientRect();
            if (!r || r.width < 1 || r.height < 1) continue;

            var fw = parseInt(pcs.fontWeight) || 400;
            var textColor = getRgb(pcs.color) || { r: 0.1, g: 0.1, b: 0.1 };

            texts.push({
                type:       'TEXT',
                name:       content.slice(0, 40),
                x:          Math.round(r.left + sx),
                y:          Math.round(r.top  + sy),
                width:      Math.round(r.width),
                height:     Math.round(r.height),
                characters: content,
                fontSize:   pf(pcs.fontSize),
                fontWeight: fw,
                fontFamily: pcs.fontFamily,
                fills:      [{ type: 'SOLID', color: textColor, opacity: 1 }],
                constraints: { horizontal: 'SCALE', vertical: 'MIN' }
            });
        }

        return texts;
    }

    // ── Main ─────────────────────────────────────────────────────────────────

    try {
        chrome.runtime.sendMessage({ action: 'capture_start' });

        var sx = window.scrollX || 0;
        var sy = window.scrollY || 0;

        // Fase 1: frames estruturais
        var frames = [];
        for (var i = 0; i < document.body.children.length; i++) {
            var f = captureFrame(document.body.children[i], 0, sx, sy);
            if (f) frames.push(f);
        }

        // Fase 2: todos os textos
        var texts = captureTexts(document.body, sx, sy);

        // Merge: frames primeiro (fundo), textos por cima
        var layers = frames.concat(texts);

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
        var slug     = (window.location.hostname || 'localhost').replace(/\./g, '_');
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
