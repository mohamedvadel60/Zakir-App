import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateTrueHiDpiLogos() {
  const logoSvgPath = path.join(process.cwd(), 'logo.txt');
  const svgContent = fs.readFileSync(logoSvgPath, 'utf-8');

  console.log('Generating true HiDPI/Retina assets from logo.txt...');

  // 1. Master Retina 768x768 (8x density for 96x96 display)
  // Rasterized directly from vector paths using Lanczos3 interpolation
  const retina768Buffer = await sharp(Buffer.from(svgContent))
    .resize(768, 768, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      quality: 100
    })
    .toBuffer();

  // 2. Ultra 1024x1024 for master archives
  const ultra1024Buffer = await sharp(Buffer.from(svgContent))
    .resize(1024, 1024, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      quality: 100
    })
    .toBuffer();

  // 3. Mini footer icon 192x192 (8x density for 24x24 display)
  const mini192Buffer = await sharp(Buffer.from(svgContent))
    .resize(192, 192, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      quality: 100
    })
    .toBuffer();

  const publicDir = path.join(process.cwd(), 'public');
  const emailAssetsDir = path.join(process.cwd(), 'public', 'email-assets');
  const srcAssetsDir = path.join(process.cwd(), 'src', 'assets');

  if (!fs.existsSync(emailAssetsDir)) fs.mkdirSync(emailAssetsDir, { recursive: true });
  if (!fs.existsSync(srcAssetsDir)) fs.mkdirSync(srcAssetsDir, { recursive: true });

  const meta768 = await sharp(retina768Buffer).metadata();
  console.log(`Retina 768 asset: ${meta768.width}x${meta768.height} px, Size: ${retina768Buffer.length} bytes`);

  const meta1024 = await sharp(ultra1024Buffer).metadata();
  console.log(`Ultra 1024 asset: ${meta1024.width}x${meta1024.height} px, Size: ${ultra1024Buffer.length} bytes`);

  const filesToWrite = [
    { dir: publicDir, name: 'zakir-email-logo.png', buf: retina768Buffer },
    { dir: publicDir, name: 'zakir-badge-light.png', buf: retina768Buffer },
    { dir: publicDir, name: 'zakir-badge-dark.png', buf: retina768Buffer },
    { dir: publicDir, name: 'zakir-official-logo.png', buf: ultra1024Buffer },
    { dir: publicDir, name: 'zakir-logo.png', buf: ultra1024Buffer },
    { dir: publicDir, name: 'logo.png', buf: ultra1024Buffer },
    { dir: publicDir, name: 'icon-512.png', buf: ultra1024Buffer },
    { dir: emailAssetsDir, name: 'zakir-email-logo.png', buf: retina768Buffer },
    { dir: emailAssetsDir, name: 'zakir-badge-light.png', buf: retina768Buffer },
    { dir: emailAssetsDir, name: 'zakir-badge-dark.png', buf: retina768Buffer },
    { dir: srcAssetsDir, name: 'zakir-email-logo.png', buf: retina768Buffer },
    { dir: srcAssetsDir, name: 'zakir-badge-light.png', buf: retina768Buffer },
    { dir: srcAssetsDir, name: 'zakir-badge-dark.png', buf: retina768Buffer },
    { dir: srcAssetsDir, name: 'zakir-official-logo.png', buf: ultra1024Buffer },
  ];

  for (const f of filesToWrite) {
    fs.writeFileSync(path.join(f.dir, f.name), f.buf);
    console.log(`Wrote ${path.join(f.dir, f.name)} (${f.buf.length} bytes)`);
  }

  // Ensure SVGs are identical to source of truth
  fs.writeFileSync(path.join(publicDir, 'zakir-badge-light.svg'), svgContent);
  fs.writeFileSync(path.join(publicDir, 'zakir-badge-dark.svg'), svgContent);
  fs.writeFileSync(path.join(publicDir, 'zakir-email-logo.svg'), svgContent);
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), svgContent);

  console.log('✅ HiDPI Assets successfully generated!');
}

generateTrueHiDpiLogos().catch(console.error);
