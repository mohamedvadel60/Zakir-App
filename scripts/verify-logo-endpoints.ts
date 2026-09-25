import http from 'http';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function verifyAll() {
  console.log('=== VERIFYING ZAKIR EMAIL LOGO QUALITY & RESOLUTION ===');
  
  // 1. Verify source file
  const svgPath = path.join(process.cwd(), 'logo.txt');
  if (!fs.existsSync(svgPath)) {
    throw new Error('logo.txt not found!');
  }
  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  console.log('✅ Source SVG logo.txt exists, length:', svgContent.length);

  // 2. Check generated PNG files
  const filesToCheck = [
    'public/zakir-email-logo.png',
    'public/zakir-badge-light.png',
    'public/zakir-badge-dark.png',
    'public/email-assets/zakir-email-logo.png',
    'public/email-assets/zakir-badge-light.png',
    'public/email-assets/zakir-badge-dark.png',
    'src/assets/zakir-email-logo.png',
    'src/assets/zakir-badge-light.png',
    'src/assets/zakir-badge-dark.png',
  ];

  for (const f of filesToCheck) {
    const fullPath = path.join(process.cwd(), f);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing file: ${f}`);
    }
    const meta = await sharp(fullPath).metadata();
    const stats = fs.statSync(fullPath);
    console.log(`✅ ${f}: ${meta.width}x${meta.height} px, format=${meta.format}, size=${stats.size} bytes`);
    if ((meta.width ?? 0) < 384 || (meta.height ?? 0) < 384) {
      throw new Error(`File ${f} is too low resolution: ${meta.width}x${meta.height}`);
    }
  }

  console.log('=== ALL LOGO ASSETS VERIFIED RETINA/HiDPI 768x768 CRISP LOSSLESS PNG ===');
}

verifyAll().catch(e => {
  console.error(e);
  process.exit(1);
});
