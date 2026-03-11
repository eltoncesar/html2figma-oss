# html2figma-oss

> Importe qualquer site como nós editáveis no Figma — gratuito e open source.

Extensão Chrome + Plugin Figma que captura qualquer página web (localhost ou URL pública) e importa como **frames, textos e retângulos editáveis** no Figma.

Inspirado no [figma-html](https://github.com/BuilderIO/figma-html) do BuilderIO (MIT).

---

## Como funciona

```
Qualquer site aberto no Chrome
        ↓
Clique no botão da extensão
        ↓
Página é capturada como JSON (DOM + estilos)
        ↓
Abra o Plugin Figma → importe o JSON
        ↓
Nós editáveis criados no Figma
```

---

## Instalação

### 1. Instalar dependências e fazer o build

```bash
npm install
npm run build
```

### 2. Instalar a extensão Chrome

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension/`

### 3. Instalar o Plugin Figma

1. No Figma, vá em **Plugins → Desenvolvimento → Importar plugin do manifesto**
2. Selecione o arquivo `plugin/manifest.json`

---

## Como usar

1. Abra qualquer site no Chrome
2. Clique no ícone da extensão **html2figma**
3. Clique em **Capturar página** — um arquivo `.json` será baixado
4. No Figma, abra o plugin **html2figma**
5. Arraste o arquivo `.json` para a área de importação
6. Clique em **Importar para o Figma**

---

## Estrutura do projeto

```
html2figma-oss/
├── extension/
│   ├── manifest.json       ← Chrome Extension Manifest V3
│   ├── popup.html          ← UI do botão da extensão
│   ├── src/
│   │   ├── background.js   ← Service worker (MV3)
│   │   ├── content.js      ← Captura o DOM (usa @builder.io/html-to-figma)
│   │   └── popup.js        ← Lógica do popup
│   └── dist/               ← Gerado pelo build
│
├── plugin/
│   ├── manifest.json       ← Plugin Figma
│   ├── ui.html             ← Interface do plugin
│   └── code.js             ← Cria os nós no Figma
│
├── build.js                ← Script de build (esbuild)
└── package.json
```

---

## Stack

- `@builder.io/html-to-figma` — conversão DOM → Figma JSON (MIT)
- Chrome Extension Manifest V3
- Figma Plugin API
- esbuild (bundler)

---

## Roadmap

- [x] MVP: captura + importação via JSON
- [ ] Importação direta (sem arquivo intermediário) via WebSocket
- [ ] Suporte a SVG e ícones
- [ ] Captura de múltiplas páginas
- [ ] Mapeamento de variáveis Figma
- [ ] Publicação na Chrome Web Store

---

## Licença

MIT — livre para usar, modificar e distribuir.

---

## Autor

Elton Cesar de Arruda Gloria
elton.gloria@tce.ro.gov.br | elton.gloria@pdcase.com.br
