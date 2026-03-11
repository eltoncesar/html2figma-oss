// Capturador DOM com getComputedStyle — resolve CSS variables
// v3: captura texto com filhos inline + cores primárias

(function () {
    var SKIP_TAGS   = { SCRIPT:1, STYLE:1, NOSCRIPT:1, HEAD:1, META:1, LINK:1, TITLE:1 };
    var INLINE_TAGS = { SPAN:1, STRONG:1, EM:1, B:1, I:1, A:1, SMALL:1, LABEL:1, ABBR:1, CODE:1, S:1, U:1 };
    var TEXT_TAGS   = { P:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, LI:1, TD:1, TH:1,
                        BUTTON:1, SPAN:1, LABEL:1, CAPTION:1, DT:1, DD:1, FIGCAPTION:1 };
    var MAX_DEPTH   = 20;
    var MIN_SIZE    = 1;

    function parseColor(str) {
        if (!str) return null;
        str = str.trim();
        if (str === 'transparent' || str === 'none' || str === '') return null;
        var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (m) {
            var a = m[4] !== undefined ? parseFloat(m[4]) : 1;
            if (a < 0.02) return null;
            return { r: parseInt(m[1])/255, g: parseInt(m[2])/255, b: parseInt(m[3])/255 };
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

    // Verifica se todos os filhos element são inline
    function hasOnlyInlineChildren(el) {
        for (var i = 0; i < el.children.length; i++) {
            if (!INLINE_TAGS[el.children[i].tagName]) return false;
        }
        return true;
    }

    function captureNode(el, depth, scrollX, scrollY) {
        if (!el || el.nodeType !== 1) return null;
        if (SKIP_TAGS[el.tagName]) return null;
        if (depth > MAX_DEPTH) return null;

        var rect = el.getBoundingClientRect();
        var w = Math.round(rect.width);
        var h = Math.round(rect.height);
        if (w < MIN_SIZE || h < MIN_SIZE) return null;

        var x  = Math.round(rect.left + scrollX);
        var y  = Math.round(rect.top  + scrollY);
        var cs = window.getComputedStyle(el);
        var tag = el.tagName.toUpperCase();

        // ── SVG (ícone) ──────────────────────────────────────────────────────
        if (tag === 'SVG') {
            var iconColor = parseColor(cs.color) || { r: 0.4, g: 0.4, b: 0.4 };
            return { type: 'RECTANGLE', name: 'icon', x: x, y: y, width: w, height: h,
                fills: [{ type: 'SOLID', color: iconColor }],
                topLeftRadius: 2, topRightRadius: 2, bottomRightRadius: 2, bottomLeftRadius: 2 };
        }

        // ── IMG ──────────────────────────────────────────────────────────────
        if (tag === 'IMG') {
            return { type: 'RECTANGLE', name: el.alt || 'image', x: x, y: y, width: w, height: h,
                fills: [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }],
                topLeftRadius: 0, topRightRadius: 0, bottomRightRadius: 0, bottomLeftRadius: 0 };
        }

        // ── Texto: sem filhos OU tag de texto com apenas filhos inline ───────
        var isTextLike = TEXT_TAGS[tag] && hasOnlyInlineChildren(el);
        var isLeafText = el.children.length === 0;

        if (isLeafText || isTextLike) {
            var text = (el.innerText || el.textContent || '').trim();
            if (!text) return null;

            var textColor = parseColor(cs.color) || { r: 0.1, g: 0.1, b: 0.1 };
            var fw = parseInt(cs.fontWeight) || 400;
            return {
                type:       'TEXT',
                name:       text.slice(0, 40),
                x:          x,
                y:          y,
                width:      w,
                height:     h,
                characters: text,
                fontSize:   pf(cs.fontSize),
                fontWeight: fw,
                fontFamily: cs.fontFamily,
                fills:      [{ type: 'SOLID', color: textColor, opacity: 1 }],
                lineHeight: { unit: 'PIXELS', value: pf(cs.lineHeight) || pf(cs.fontSize) * 1.4 },
                constraints: { horizontal: 'SCALE', vertical: 'MIN' }
            };
        }

        // ── Frame / container ────────────────────────────────────────────────
        var node = {
            type:         'FRAME',
            name:         tag.toLowerCase() + (el.id ? '#'+el.id : ''),
            x:            x,
            y:            y,
            width:        w,
            height:       h,
            clipsContent: cs.overflow === 'hidden' || cs.overflow === 'clip',
            backgrounds:  [],
            children:     [],
            constraints:  { horizontal: 'SCALE', vertical: 'MIN' }
        };

        // Cor de fundo resolvida
        var bgColor = parseColor(cs.backgroundColor);
        if (bgColor) node.backgrounds = [{ type: 'SOLID', color: bgColor }];

        // Border radius
        node.topLeftRadius     = pf(cs.borderTopLeftRadius);
        node.topRightRadius    = pf(cs.borderTopRightRadius);
        node.bottomRightRadius = pf(cs.borderBottomRightRadius);
        node.bottomLeftRadius  = pf(cs.borderBottomLeftRadius);

        // Opacidade
        var op = parseFloat(cs.opacity);
        if (!isNaN(op) && op < 1) node.opacity = op;

        // Borda visível → adiciona como fill de borda (simplificado)
        var borderColor = parseColor(cs.borderColor);
        var borderWidth = pf(cs.borderWidth);
        if (borderColor && borderWidth > 0) {
            node.strokes = [{ type: 'SOLID', color: borderColor }];
            node.strokeWeight = borderWidth;
        }

        // Filhos
        for (var i = 0; i < el.children.length; i++) {
            var child = captureNode(el.children[i], depth + 1, scrollX, scrollY);
            if (child) node.children.push(child);
        }

        return node;
    }

    // ── Main ─────────────────────────────────────────────────────────────────
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
