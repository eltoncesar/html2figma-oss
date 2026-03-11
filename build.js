const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

const base = {
    bundle: true,
    minify: !watch,
    sourcemap: watch ? 'inline' : false
};

// Bundla o content script com a lib do BuilderIO
esbuild.build({
    ...base,
    entryPoints: ['extension/src/content.js'],
    outfile: 'extension/dist/content.bundle.js',
    platform: 'browser',
    watch: watch ? { onRebuild: (err) => err && console.error(err) } : false
}).then(() => console.log('✓ content.bundle.js'));

// Bundla o popup
esbuild.build({
    ...base,
    entryPoints: ['extension/src/popup.js'],
    outfile: 'extension/dist/popup.bundle.js',
    platform: 'browser',
    watch: watch ? { onRebuild: (err) => err && console.error(err) } : false
}).then(() => console.log('✓ popup.bundle.js'));
