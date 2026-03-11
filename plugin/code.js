// Plugin Figma — code.js
// Suporta o formato BuilderIO/html-to-figma E o formato do nosso capturador próprio

figma.showUI(__html__, { width: 320, height: 280, title: 'html2figma' });

figma.ui.onmessage = function (msg) {
    if (msg.type !== 'import') return;
    run(msg.data).catch(function (err) {
        figma.ui.postMessage({ type: 'error', error: String(err) });
    });
};

async function run(raw) {
    var layers, meta;

    if (Array.isArray(raw)) {
        layers = raw;
        meta   = {};
    } else if (raw && Array.isArray(raw.layers)) {
        layers = raw.layers;
        meta   = raw.meta || {};
    } else {
        figma.ui.postMessage({ type: 'error', error: 'JSON inválido. Chaves: ' + Object.keys(raw || {}).join(', ') });
        return;
    }

    if (!layers.length) {
        figma.ui.postMessage({ type: 'error', error: 'Nenhuma camada encontrada.' });
        return;
    }

    var pageFrame = figma.createFrame();
    pageFrame.name         = (meta.title || meta.url || 'Página Importada');
    pageFrame.x            = Math.round(figma.viewport.bounds.x + 100);
    pageFrame.y            = Math.round(figma.viewport.bounds.y + 100);
    pageFrame.resize(meta.width || 1440, meta.height || 900);
    pageFrame.fills        = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    pageFrame.clipsContent = true;

    var count = 0;
    for (var i = 0; i < layers.length; i++) {
        try {
            var node = await buildNode(layers[i]);
            if (node) { pageFrame.appendChild(node); count++; }
        } catch (e) { console.error('camada ignorada:', e.message); }
    }

    figma.currentPage.appendChild(pageFrame);
    figma.viewport.scrollAndZoomIntoView([pageFrame]);
    figma.ui.postMessage({ type: 'done', count: count });
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function buildNode(layer) {
    if (!layer || typeof layer !== 'object') return null;
    var t = (layer.type || '').toUpperCase();

    if (t === 'TEXT')                          return await buildText(layer);
    if (t === 'RECTANGLE' || t === 'ELLIPSE') return buildRect(layer);
    if (t === 'IMAGE')                        return buildRect(layer);
    if (t === 'VECTOR' || t === 'BOOLEAN_OPERATION') return buildRect(layer);
    // FRAME, GROUP, COMPONENT, INSTANCE → Frame
    return await buildFrame(layer);
}

// ─── Frame ────────────────────────────────────────────────────────────────────

async function buildFrame(layer) {
    var frame = figma.createFrame();
    applyBase(frame, layer);

    frame.clipsContent = layer.clipsContent === true;

    // Auto Layout
    if (layer.layoutMode === 'HORIZONTAL' || layer.layoutMode === 'VERTICAL') {
        frame.layoutMode  = layer.layoutMode;
        frame.itemSpacing = num(layer.itemSpacing, 0);
        frame.paddingTop  = num(layer.paddingTop,    0);
        frame.paddingBottom = num(layer.paddingBottom, 0);
        frame.paddingLeft   = num(layer.paddingLeft,   0);
        frame.paddingRight  = num(layer.paddingRight,  0);
    } else if (layer.display === 'flex') {
        frame.layoutMode  = layer.flexDirection === 'column' ? 'VERTICAL' : 'HORIZONTAL';
        frame.itemSpacing = num(layer.gap, 0);
        frame.paddingTop  = num(layer.paddingTop,    0);
        frame.paddingBottom = num(layer.paddingBottom, 0);
        frame.paddingLeft   = num(layer.paddingLeft,   0);
        frame.paddingRight  = num(layer.paddingRight,  0);
    }

    // Filhos
    var children = layer.children || layer.layers || [];
    for (var i = 0; i < children.length; i++) {
        try {
            var child = await buildNode(children[i]);
            if (child) frame.appendChild(child);
        } catch (e) { console.error('filho ignorado:', e.message); }
    }

    return frame;
}

// ─── Rectangle ────────────────────────────────────────────────────────────────

function buildRect(layer) {
    var rect = figma.createRectangle();
    applyBase(rect, layer);
    applyCorners(rect, layer);
    return rect;
}

// ─── Text ─────────────────────────────────────────────────────────────────────

// Fontes seguras disponíveis no Figma
var SAFE_FONTS = ['Inter', 'Roboto', 'Arial', 'Helvetica', 'Georgia', 'Verdana'];

async function loadFont(family, style) {
    // Tenta a fonte original primeiro
    var candidates = [family].concat(SAFE_FONTS);
    for (var i = 0; i < candidates.length; i++) {
        try {
            await figma.loadFontAsync({ family: candidates[i], style: style });
            return candidates[i];
        } catch (e) {}
    }
    // Último recurso: Inter Regular
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    return 'Inter';
}

async function buildText(layer) {
    var text = figma.createText();

    var raw    = layer.fontFamily || 'Inter';
    var family = raw.split(',')[0].trim().replace(/['"]/g, '') || 'Inter';
    var weight = parseInt(layer.fontWeight || 400) || 400;
    var style  = weight >= 700 ? 'Bold' : weight >= 600 ? 'SemiBold' : weight >= 500 ? 'Medium' : 'Regular';

    var usedFamily = await loadFont(family, style);

    // Posição
    text.name = layer.name || 'text';
    text.x    = Math.round(num(layer.x, 0));
    text.y    = Math.round(num(layer.y, 0));

    // Conteúdo — deve ser definido APÓS carregar a fonte
    text.characters = String(layer.characters || layer.value || layer.text || '');
    text.fontSize   = num(layer.fontSize, 14);
    text.fontName   = { family: usedFamily, style: style };

    // Opacidade
    if (layer.opacity != null) text.opacity = Math.min(1, Math.max(0, num(layer.opacity, 1)));

    // Cor — usa fills do BuilderIO ou color do nosso formato
    var color = null;
    if (layer.fills && layer.fills.length) {
        color = resolveColor(layer.fills[0].color || layer.fills[0]);
    }
    if (!color) color = resolveColor(layer.color);
    if (!color) color = { r: 0.1, g: 0.1, b: 0.1 }; // fallback: cinza escuro legível

    text.fills = [{ type: 'SOLID', color: color }];

    return text;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyBase(node, layer) {
    node.name = layer.name || layer.tagName || layer.type || 'node';
    node.x    = Math.round(num(layer.x, 0));
    node.y    = Math.round(num(layer.y, 0));

    var w = num(layer.width  || (layer.size && layer.size.width),  10);
    var h = num(layer.height || (layer.size && layer.size.height), 10);
    node.resize(Math.max(Math.round(w), 1), Math.max(Math.round(h), 1));

    if (layer.opacity != null) node.opacity = Math.min(1, Math.max(0, num(layer.opacity, 1)));

    // Fills (formato BuilderIO ou nosso)
    var fills = resolveFills(layer);
    if (fills) node.fills = fills;

    // Constraints
    if (layer.constraints && node.constraints !== undefined) {
        try { node.constraints = layer.constraints; } catch (e) {}
    }

    // Sombra
    if (layer.boxShadow && layer.boxShadow !== 'none') {
        node.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.12 },
            offset: { x: 0, y: 2 }, radius: 8, spread: 0, visible: true, blendMode: 'NORMAL' }];
    }
}

function applyCorners(node, layer) {
    // Formato BuilderIO
    if (layer.topLeftRadius     != null) { try { node.topLeftRadius     = num(layer.topLeftRadius, 0); } catch(e){} }
    if (layer.topRightRadius    != null) { try { node.topRightRadius    = num(layer.topRightRadius, 0); } catch(e){} }
    if (layer.bottomRightRadius != null) { try { node.bottomRightRadius = num(layer.bottomRightRadius, 0); } catch(e){} }
    if (layer.bottomLeftRadius  != null) { try { node.bottomLeftRadius  = num(layer.bottomLeftRadius, 0); } catch(e){} }
    // Formato nosso
    if (layer.borderRadius != null) { try { node.cornerRadius = num(layer.borderRadius, 0); } catch(e){} }
}

function resolveFills(layer) {
    // Formato BuilderIO: fills é array de objetos com { type, color }
    if (layer.fills && layer.fills.length) {
        var out = [];
        for (var i = 0; i < layer.fills.length; i++) {
            var f = layer.fills[i];
            if (f.type === 'SOLID' || !f.type) {
                var c = resolveColor(f.color || f);
                if (c) out.push({ type: 'SOLID', color: c, opacity: num(f.opacity, 1) });
            }
        }
        return out.length ? out : [];
    }
    // Formato backgrounds (BuilderIO)
    if (layer.backgrounds && layer.backgrounds.length) {
        var out2 = [];
        for (var j = 0; j < layer.backgrounds.length; j++) {
            var b = layer.backgrounds[j];
            var c2 = resolveColor(b.color || b);
            if (c2) out2.push({ type: 'SOLID', color: c2 });
        }
        return out2.length ? out2 : null;
    }
    // Formato nosso: backgroundColor é { r, g, b }
    if (layer.backgroundColor) {
        var c3 = resolveColor(layer.backgroundColor);
        if (c3) return [{ type: 'SOLID', color: c3 }];
    }
    return null;
}

function resolveColor(c) {
    if (!c) return null;
    if (typeof c === 'object' && 'r' in c) {
        var r = c.r, g = c.g, b = c.b;
        // Já normalizado (0-1)
        if (r <= 1 && g <= 1 && b <= 1) return { r: r, g: g, b: b };
        return { r: r / 255, g: g / 255, b: b / 255 };
    }
    if (typeof c === 'string') {
        if (c === 'transparent' || c === 'none') return null;
        if (c.charAt(0) === '#') {
            var h = c.replace('#', '');
            if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
            var n = parseInt(h, 16);
            return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
        }
        var m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return { r: parseInt(m[1]) / 255, g: parseInt(m[2]) / 255, b: parseInt(m[3]) / 255 };
    }
    return null;
}

function num(v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? (fallback !== undefined ? fallback : 0) : n;
}
