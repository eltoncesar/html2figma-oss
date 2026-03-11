// Gera ícones PNG simples (quadrado roxo com "F") para a extensão Chrome
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (const b of buf) {
        crc ^= b;
        for (let k = 0; k < 8; k++) crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
    const typeBuf = Buffer.from(type);
    const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
    const crcBuf  = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePNG(size) {
    // Cor de fundo: roxo #7c3aed = 124, 58, 237
    const R = 124, G = 58, B = 237;

    // Monta os dados de imagem: cada linha começa com filtro 0x00
    const rows = [];
    for (let y = 0; y < size; y++) {
        const row = Buffer.alloc(1 + size * 3);
        row[0] = 0; // filtro None
        for (let x = 0; x < size; x++) {
            row[1 + x * 3]     = R;
            row[1 + x * 3 + 1] = G;
            row[1 + x * 3 + 2] = B;
        }
        rows.push(row);
    }

    const raw      = Buffer.concat(rows);
    const deflated = zlib.deflateSync(raw);

    const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // RGB

    const png = Buffer.concat([
        sig,
        chunk('IHDR', ihdr),
        chunk('IDAT', deflated),
        chunk('IEND', Buffer.alloc(0))
    ]);

    return png;
}

const dir = path.join(__dirname, 'extension', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

[16, 48, 128].forEach(size => {
    const file = path.join(dir, `icon${size}.png`);
    fs.writeFileSync(file, makePNG(size));
    console.log(`✓ icon${size}.png`);
});

console.log('\n✅ Ícones gerados em extension/icons/');
