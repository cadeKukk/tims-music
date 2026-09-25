import sharp from 'sharp';
const svg = 'public/icons/icon.svg';
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(svg, { density: 400 }).resize(size, size).png().toFile(`public/icons/${name}`);
}
// Maskable: art inset on a full-bleed background so Android's circle crop doesn't clip the note.
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#e0284b' } })
  .composite([{ input: await sharp(svg, { density: 400 }).resize(380, 380).png().toBuffer(), gravity: 'center' }])
  .png().toFile('public/icons/icon-maskable-512.png');
