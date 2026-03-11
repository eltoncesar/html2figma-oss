// Plugin Figma — code.js
// Recebe o JSON gerado pela extensão e cria nós editáveis no Figma

figma.showUI(__html__, { width: 320, height: 280, title: 'html2figma' });

figma.ui.onmessage = async (msg) => {
    if (msg.type !== 'import') return;

    try {
        const { layers, meta } = msg.data;

        if (!layers || !Array.isArray(layers)) {
            figma.ui.postMessage({ type: 'error', error: 'Arquivo inválido ou corrompido.' });
            return;
        }

        // Frame raiz com o nome da página capturada
        const pageFrame = figma.createFrame();
        pageFrame.name = meta?.title || meta?.url || 'Página Importada';
        pageFrame.x = figma.viewport.center.x - (meta?.width || 1440) / 2;
        pageFrame.y = figma.viewport.center.y;
        pageFrame.resize(meta?.width || 1440, 900);
        pageFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        pageFrame.clipsContent = true;

        let count = 0;

        // Processa cada camada do JSON
        for (const layer of layers) {
            const node = await processLayer(layer);
            if (node) {
                pageFrame.appendChild(node);
                count++;
            }
        }

        figma.currentPage.appendChild(pageFrame);
        figma.viewport.scrollAndZoomIntoView([pageFrame]);
        figma.ui.postMessage({ type: 'done', count });

    } catch (err) {
        figma.ui.postMessage({ type: 'error', error: err.message });
    }
};

// Converte uma camada do JSON em nó Figma
async function processLayer(layer) {
    if (!layer) return null;

    // Nó de texto
    if (layer.type === 'TEXT' || layer.characters) {
        return await createTextNode(layer);
    }

    // Nó de imagem
    if (layer.type === 'IMAGE' || layer.imageUrl) {
        return await createImageNode(layer);
    }

    // Frame / retângulo (padrão para divs)
    return await createFrameNode(layer);
}

async function createFrameNode(layer) {
    const frame = figma.createFrame();

    frame.name = layer.name || layer.type || 'Frame';
    frame.x = Math.round(layer.x || 0);
    frame.y = Math.round(layer.y || 0);
    frame.resize(
        Math.max(Math.round(layer.width || 100), 1),
        Math.max(Math.round(layer.height || 100), 1)
    );

    // Cor de fundo
    if (layer.backgroundColor) {
        frame.fills = [{ type: 'SOLID', color: hexToRgb(layer.backgroundColor) }];
    } else {
        frame.fills = [];
    }

    // Border radius
    if (layer.borderRadius) {
        frame.cornerRadius = parseInt(layer.borderRadius) || 0;
    }

    // Opacidade
    if (layer.opacity !== undefined) {
        frame.opacity = layer.opacity;
    }

    // Auto Layout se tiver flex
    if (layer.display === 'flex') {
        frame.layoutMode = layer.flexDirection === 'column' ? 'VERTICAL' : 'HORIZONTAL';
        frame.itemSpacing = parseInt(layer.gap) || 0;
        frame.paddingTop    = parseInt(layer.paddingTop)    || 0;
        frame.paddingBottom = parseInt(layer.paddingBottom) || 0;
        frame.paddingLeft   = parseInt(layer.paddingLeft)   || 0;
        frame.paddingRight  = parseInt(layer.paddingRight)  || 0;
    }

    // Sombra
    if (layer.boxShadow) {
        frame.effects = [parseShadow(layer.boxShadow)];
    }

    // Processa filhos recursivamente
    if (layer.children && Array.isArray(layer.children)) {
        for (const child of layer.children) {
            const childNode = await processLayer(child);
            if (childNode) frame.appendChild(childNode);
        }
    }

    return frame;
}

async function createTextNode(layer) {
    const text = figma.createText();

    // Carrega a fonte antes de definir o texto
    const fontFamily = layer.fontFamily || 'Inter';
    const fontStyle  = layer.fontWeight >= 700 ? 'Bold'
                     : layer.fontWeight >= 600 ? 'SemiBold'
                     : layer.fontWeight >= 500 ? 'Medium'
                     : 'Regular';

    try {
        await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    } catch {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    }

    text.name = layer.name || 'Texto';
    text.x = Math.round(layer.x || 0);
    text.y = Math.round(layer.y || 0);
    text.characters = layer.characters || layer.text || '';
    text.fontSize   = parseInt(layer.fontSize) || 14;

    if (layer.color) {
        text.fills = [{ type: 'SOLID', color: hexToRgb(layer.color) }];
    }

    if (layer.opacity !== undefined) {
        text.opacity = layer.opacity;
    }

    return text;
}

async function createImageNode(layer) {
    const rect = figma.createRectangle();
    rect.name = layer.name || 'Imagem';
    rect.x = Math.round(layer.x || 0);
    rect.y = Math.round(layer.y || 0);
    rect.resize(
        Math.max(Math.round(layer.width || 100), 1),
        Math.max(Math.round(layer.height || 100), 1)
    );
    rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
    return rect;
}

// Utilitários

function hexToRgb(hex) {
    if (!hex || !hex.startsWith('#')) {
        return parseRgba(hex) || { r: 0, g: 0, b: 0 };
    }
    const clean = hex.replace('#', '');
    const num   = parseInt(clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean, 16);
    return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8)  & 255) / 255,
        b: (num         & 255) / 255
    };
}

function parseRgba(str) {
    if (!str) return null;
    const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    return {
        r: parseInt(match[1]) / 255,
        g: parseInt(match[2]) / 255,
        b: parseInt(match[3]) / 255
    };
}

function parseShadow(shadow) {
    return {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.15 },
        offset: { x: 0, y: 2 },
        radius: 8,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
    };
}
