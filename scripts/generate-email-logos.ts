import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateCleanLogos() {
  const logoSvgPath = path.join(process.cwd(), 'logo.txt');
  const svgContent = fs.readFileSync(logoSvgPath, 'utf-8');

  console.log('Generating pristine PNGs directly from source of truth logo.txt...');

  // 1. Full Master PNG (1999x1999 native from SVG)
  const masterBuffer = await sharp(Buffer.from(svgContent))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  // 2. High-Resolution 512x512 PNG (clean lossless downscale with transparent rounded corners)
  const retina512Buffer = await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const publicDir = path.join(process.cwd(), 'public');
  const emailAssetsDir = path.join(process.cwd(), 'public', 'email-assets');
  const srcAssetsDir = path.join(process.cwd(), 'src', 'assets');

  if (!fs.existsSync(emailAssetsDir)) fs.mkdirSync(emailAssetsDir, { recursive: true });
  if (!fs.existsSync(srcAssetsDir)) fs.mkdirSync(srcAssetsDir, { recursive: true });

  const targets = [
    { dir: publicDir, name: 'zakir-email-logo.png', buf: retina512Buffer },
    { dir: publicDir, name: 'zakir-badge-light.png', buf: retina512Buffer },
    { dir: publicDir, name: 'zakir-badge-dark.png', buf: retina512Buffer },
    { dir: publicDir, name: 'zakir-official-logo.png', buf: masterBuffer },
    { dir: publicDir, name: 'zakir-logo.png', buf: masterBuffer },
    { dir: publicDir, name: 'logo.png', buf: masterBuffer },
    { dir: publicDir, name: 'icon-512.png', buf: retina512Buffer },
    { dir: emailAssetsDir, name: 'zakir-email-logo.png', buf: retina512Buffer },
    { dir: emailAssetsDir, name: 'zakir-badge-light.png', buf: retina512Buffer },
    { dir: emailAssetsDir, name: 'zakir-badge-dark.png', buf: retina512Buffer },
    { dir: srcAssetsDir, name: 'zakir-email-logo.png', buf: retina512Buffer },
    { dir: srcAssetsDir, name: 'zakir-badge-light.png', buf: retina512Buffer },
    { dir: srcAssetsDir, name: 'zakir-badge-dark.png', buf: retina512Buffer },
    { dir: srcAssetsDir, name: 'zakir-official-logo.png', buf: masterBuffer },
  ];

  for (const t of targets) {
    fs.writeFileSync(path.join(t.dir, t.name), t.buf);
    console.log(`Saved ${path.join(t.dir, t.name)} (${t.buf.length} bytes)`);
  }

  // Write SVGs
  fs.writeFileSync(path.join(publicDir, 'zakir-badge-light.svg'), svgContent);
  fs.writeFileSync(path.join(publicDir, 'zakir-badge-dark.svg'), svgContent);
  fs.writeFileSync(path.join(publicDir, 'zakir-email-logo.svg'), svgContent);
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), svgContent);

  console.log('✅ Pristine logos generated directly from logo.txt successfully!');
}

generateCleanLogos().catch(console.error);
