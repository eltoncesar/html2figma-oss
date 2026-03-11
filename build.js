const esbuild = require('esbuild');

async function build() {
    const opts = {
        bundle: true,
        minify: true,
        platform: 'browser'
    };

    await esbuild.build({
        ...opts,
        entryPoints: ['extension/src/content.js'],
        outfile: 'extension/dist/content.bundle.js'
    });
    console.log('✓ content.bundle.js');

    await esbuild.build({
        ...opts,
        entryPoints: ['extension/src/popup.js'],
        outfile: 'extension/dist/popup.bundle.js'
    });
    console.log('✓ popup.bundle.js');

    console.log('\n✅ Build concluído! Pasta: extension/dist/');
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
