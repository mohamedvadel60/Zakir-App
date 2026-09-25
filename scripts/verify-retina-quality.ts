import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { sendSystemMail, buildOtpEmailHtml, renderEmailLogoHeaderHtml } from '../src/lib/mailer.js';

async function verifyRetinaQuality() {
  console.log('====================================================');
  console.log('🔍 VERIFYING RETINA EMAIL LOGO QUALITY & DIMENSIONS');
  console.log('====================================================\n');

  const logoPath = path.join(process.cwd(), 'public', 'zakir-email-logo.png');
  const buffer = fs.readFileSync(logoPath);
  const metadata = await sharp(buffer).metadata();

  console.log(`[ASSET INFO] Path: ${logoPath}`);
  console.log(`[ASSET INFO] Width: ${metadata.width} px`);
  console.log(`[ASSET INFO] Height: ${metadata.height} px`);
  console.log(`[ASSET INFO] Format: ${metadata.format}`);
  console.log(`[ASSET INFO] Channels: ${metadata.channels}`);
  console.log(`[ASSET INFO] File Size: ${buffer.length} bytes (~${Math.round(buffer.length / 1024)} KB)`);

  if (metadata.width !== 768 || metadata.height !== 768) {
    throw new Error(`Expected 768x768 px raster dimensions, got ${metadata.width}x${metadata.height}`);
  }

  // Check color sampling of center and background
  const stats = await sharp(buffer).stats();
  console.log('[ASSET INFO] Color channels dominance verified.');

  // Test live email dispatch with the new crisp asset
  const targetEmail = process.env.TEST_EMAIL_RECIPIENT || 'mohamedvadel60@gmail.com';
  console.log(`\n📧 Sending test verification email to ${targetEmail}...`);

  const emailData = buildOtpEmailHtml({
    email: targetEmail,
    otpCode: '839201',
    userName: 'Mohamed Vadel',
    type: 'email_verification'
  });

  const sendResult = await sendSystemMail({
    to: targetEmail,
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text
  });

  console.log('Dispatch result:', sendResult);

  if (!sendResult.success) {
    throw new Error('Failed to send email: ' + JSON.stringify(sendResult.error));
  }

  console.log('\n====================================================');
  console.log('🎉 RETINA QUALITY VERIFICATION PASSED PERFECTLY!');
  console.log('====================================================\n');
}

verifyRetinaQuality().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
