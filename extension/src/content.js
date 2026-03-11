// Capturador próprio usando getComputedStyle — resolve CSS variables automaticamente

(function () {
    var SKIP_TAGS = { SCRIPT:1, STYLE:1, NOSCRIPT:1, HEAD:1, META:1, LINK:1, TITLE:1, SVG:1, PATH:1 };
    var MAX_DEPTH = 15;
    var MIN_SIZE  = 2;

    // ── Utilitários de cor ──────────────────────────────────────────────────

    function parseColor(str) {
        if (!str) return null;
        str = str.trim();
        if (str === 'transparent' || str === 'none') return null;
        if (str.indexOf('rgba') === 0) {
            var m = str.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)/);
            if (m && parseFloat(m[4]) < 0.01) return null; // totalmente transparente
            if (m) return { r: parseInt(m[1])/255, g: parseInt(m[2])/255, b: parseInt(m[3])/255 };
        }
        if (str.indexOf('rgb') === 0) {
            var m2 = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
            if (m2) return { r: parseInt(m2[1])/255, g: parseInt(m2[2])/255, b: parseInt(m2[3])/255 };
        }
        if (str.charAt(0) === '#') {
            var h = str.replace('#','');
            if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
            var n = parseInt(h, 16);
            return { r: ((n>>16)&255)/255, g: ((n>>8)&255)/255, b: (n&255)/255 };
        }
        return null;
    }

    function pf(v) { return parseFloat(v) || 0; }

    // ── Captura de nó ───────────────────────────────────────────────────────

    function captureNode(el, depth, scrollX, scrollY) {
        if (!el || el.nodeType !== 1) return null;
        if (SKIP_TAGS[el.tagName]) return null;
        if (depth > MAX_DEPTH) return null;

        var rect = el.getBoundingClientRect();
        var w    = Math.round(rect.width);
        var h    = Math.round(rect.height);
        if (w < MIN_SIZE || h < MIN_SIZE) return null;

        var x = Math.round(rect.left + scrollX);
        var y = Math.round(rect.top  + scrollY);
        var cs = window.getComputedStyle(el);

        // ── Nó SVG: captura como retângulo colorido ──
        var tag = el.tagName.toUpperCase();
        if (tag === 'SVG') {
            var fill = parseColor(cs.color) || { r: 0.5, g: 0.5, b: 0.5 };
            return { type: 'RECTANGLE', name: 'icon', x: x, y: y, width: w, height: h,
                fills: [{ type: 'SOLID', color: fill }],
                topLeftRadius: 0, topRightRadius: 0, bottomRightRadius: 0, bottomLeftRadius: 0 };
        }

        // ── Nó IMG ──
        if (tag === 'IMG') {
            return { type: 'RECTANGLE', name: el.alt || 'image', x: x, y: y, width: w, height: h,
                fills: [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }],
                topLeftRadius: 0, topRightRadius: 0, bottomRightRadius: 0, bottomLeftRadius: 0 };
        }

        // ── Nó de texto puro (sem filhos element) ──
        if (el.children.length === 0) {
            var text = (el.textContent || '').trim();
            if (!text) return null;

            var color = parseColor(cs.color) || { r: 0.1, g: 0.1, b: 0.1 };
            var fw    = parseInt(cs.fontWeight) || 400;
            return {
                type:       'TEXT',
                name:       text.slice(0, 30),
                x:          x,
                y:          y,
                width:      w,
                height:     h,
                characters: text,
                fontSize:   pf(cs.fontSize),
                fontWeight: fw,
                fontFamily: cs.fontFamily,
                fills:      [{ type: 'SOLID', color: color, opacity: 1 }],
                lineHeight: { unit: 'PIXELS', value: pf(cs.lineHeight) || pf(cs.fontSize) * 1.2 },
                constraints: { horizontal: 'SCALE', vertical: 'MIN' }
            };
        }

        // ── Frame / container ──
        var node = {
            type:        'FRAME',
            name:        tag.toLowerCase() + (el.id ? '#'+el.id : ''),
            x:           x,
            y:           y,
            width:       w,
            height:      h,
            clipsContent: cs.overflow === 'hidden',
            backgrounds: [],
            children:    [],
            constraints: { horizontal: 'SCALE', vertical: 'MIN' }
        };

        // Cor de fundo (getComputedStyle resolve CSS vars)
        var bgColor = parseColor(cs.backgroundColor);
        if (bgColor) {
            node.backgrounds = [{ type: 'SOLID', color: bgColor }];
        }

        // Border radius por canto
        node.topLeftRadius     = pf(cs.borderTopLeftRadius);
        node.topRightRadius    = pf(cs.borderTopRightRadius);
        node.bottomRightRadius = pf(cs.borderBottomRightRadius);
        node.bottomLeftRadius  = pf(cs.borderBottomLeftRadius);

        // Opacidade
        var op = parseFloat(cs.opacity);
        if (!isNaN(op) && op < 1) node.opacity = op;

        // Sombra
        if (cs.boxShadow && cs.boxShadow !== 'none') node.boxShadow = cs.boxShadow;

        // Filhos
        for (var i = 0; i < el.children.length; i++) {
            var child = captureNode(el.children[i], depth + 1, scrollX, scrollY);
            if (child) node.children.push(child);
        }

        // Se frame sem fundo e sem filhos visíveis, descarta
        if (!bgColor && node.children.length === 0) return null;

        return node;
    }

    // ── Execução ────────────────────────────────────────────────────────────

    try {
        chrome.runtime.sendMessage({ action: 'capture_start' });

        var scrollX = window.scrollX || 0;
        var scrollY = window.scrollY || 0;
        var layers  = [];

        for (var i = 0; i < document.body.children.length; i++) {
            var n = captureNode(document.body.children[i], 0, scrollX, scrollY);
            if (n) layers.push(n);
        }

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
