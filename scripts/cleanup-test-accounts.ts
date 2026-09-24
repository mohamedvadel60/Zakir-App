import { adminDb, adminAuth, isFirebaseAdminAvailable } from '../src/lib/firebase-admin.js';
import fs from 'fs';

// Protected real accounts list - NEVER TOUCH OR DELETE
const PROTECTED_REAL_EMAILS = new Set([
  'mohamedvadel60@gmail.com',
  'mohamedvadhil0@entreprise8.com',
  'mohamedhaiballa64@gmail.com',
  'medvadhil7@gmail.com',
  'mohamedvadel60@hotmail.com',
  'mohamedvadel60@entreprise8.com',
  'mohamedvadhil01@hotmail.com',
  'mohamedvadhil0@gmail.com',
  'mohamedvadel60@entreprise6.com',
  'mohamevadhil01@hotmail.com',
  'anas1220045@gmail.com',
  'sarasara222341@gmail.com',
  'mohamedmed11332@gmail.com'
]);

const PROTECTED_REAL_UIDS = new Set([
  'SYhfciebGFUj29gqGaa0pqNunrk2',
  'usr_5it21aafq',
  '6ZZIUVPVrmObyaOu0ZusyHSFw5N2',
  'ArilEKd28IWsZlL3uVsCyNrpGik1',
  'BU873uljDngmkW4qothBttbxVAC3',
  'CNhO0Zc0jCdWgfLqeH5vKoKIdlH2',
  'DBOtkDM0OthA5ox8MiRDlwMuNcy1',
  'LZxLsIfTJ9QpgVOHJowpgV4Jrv13',
  'MwlaEvpmSUYQl5oopJOj7Gc3dd52',
  'aQVlmJ6g8xVhueOmjvzoKNsxbY22',
  'sDy1vlou1LUnUjyjrTeYI1U2fiP2',
  'vUmVVdZ6c3Xa9TDrHcJ9DzdvlRX2',
  'IKd49SpWgBa5XubDF2sLqaslOyF3',
  'ElyZcGgenUZWsY3o9bq0ObHaNJo1'
]);

function isTestAccount(uid: string, email: string): boolean {
  const normEmail = (email || '').trim().toLowerCase();
  
  // 1. Never delete protected accounts
  if (PROTECTED_REAL_EMAILS.has(normEmail) || PROTECTED_REAL_UIDS.has(uid)) {
    return false;
  }

  // 2. Identify test patterns
  const testEmailKeywords = [
    '@zakir-test.com',
    '@zakir.test',
    '@example.com',
    '@test.com',
    'test_',
    'testuser',
    'testnewuser',
    'ordinarytestuser',
    'auth_test_',
    'intruder_',
    'prod_e2e_recovery_',
    'audit_',
    'otp_audit_',
    'cycle_user_',
    'prod_audit_',
    'qa_',
    'unapproved.qa',
    'unverified.qa',
    'unapproved.test',
    'gate_priv_check_',
    'fresh_iso_check_',
    'postfix_reg_',
    'stripe_test_verifier',
    'user_priv_check_',
    'director@zakir.ai'
  ];

  for (const kw of testEmailKeywords) {
    if (normEmail.includes(kw)) return true;
  }

  const testIdPrefixes = [
    'usr_mue4k',
    'prod_test_restore_',
    'usr_test_',
    'usr_rej_',
    'usr_cycle_',
    'test_user_qa_',
    'qa_unapproved',
    'qa_user_verification',
    'test_verif_admin_',
    'usr_mtkpm31a',
    'usr_mu5j'
  ];

  for (const pfx of testIdPrefixes) {
    if (uid.startsWith(pfx)) return true;
  }

  if (!normEmail || normEmail === 'no email') {
    return true;
  }

  return false;
}

async function runCleanup() {
  console.log('--- STARTING SAFE TEST ACCOUNTS CLEANUP ---');

  const deletedTestAccounts: Array<{ uid: string; email: string }> = [];
  const protectedAccountsList: Array<{ uid: string; email: string }> = [];

  // 1. Process Firestore Users
  try {
    const snap = await adminDb.collection('users').get();
    console.log(`Auditing ${snap.size} Firestore accounts...`);

    for (const doc of snap.docs) {
      const d = doc.data();
      const uid = doc.id;
      const email = d.email || '';

      if (isTestAccount(uid, email)) {
        deletedTestAccounts.push({ uid, email });

        // Delete subcollections
        try {
          const memSnap = await adminDb.collection('users').doc(uid).collection('memories').get();
          for (const m of memSnap.docs) await m.ref.delete();
          const alertSnap = await adminDb.collection('users').doc(uid).collection('riskAlerts').get();
          for (const a of alertSnap.docs) await a.ref.delete();
        } catch (e) {}

        // Delete user doc
        await adminDb.collection('users').doc(uid).delete().catch(() => {});
      } else {
        protectedAccountsList.push({ uid, email });
      }
    }
  } catch (e: any) {
    console.warn('Firestore sweep notice:', e.message);
  }

  // 2. Process Firebase Auth Users
  try {
    const listAuth = await adminAuth.listUsers(500);
    console.log(`Auditing ${listAuth.users.length} Firebase Auth accounts...`);

    for (const u of listAuth.users) {
      const email = u.email || '';
      const uid = u.uid;

      if (isTestAccount(uid, email)) {
        try {
          await adminAuth.updateUser(uid, { disabled: true });
          await adminAuth.revokeRefreshTokens(uid);
          await adminAuth.deleteUser(uid);
        } catch (e: any) {
          // ignore already removed
        }
      }
    }
  } catch (e: any) {
    console.warn('Auth sweep notice:', e.message);
  }

  // 3. Process Local JSON Store
  try {
    if (fs.existsSync('src/db_store.json')) {
      const ldb = JSON.parse(fs.readFileSync('src/db_store.json', 'utf8'));
      if (ldb.users) {
        ldb.users = ldb.users.filter((u: any) => !isTestAccount(u.id || u.uid, u.email));
      }
      if (ldb.verification_codes) {
        ldb.verification_codes = ldb.verification_codes.filter((vc: any) => !isTestAccount(vc.userId || vc.id, ''));
      }
      fs.writeFileSync('src/db_store.json', JSON.stringify(ldb, null, 2), 'utf8');
    }
  } catch (e: any) {
    console.warn('Local db sweep notice:', e.message);
  }

  console.log('\n================ CLEANUP SUMMARY ================');
  console.log(`Total Test Accounts Deleted: ${deletedTestAccounts.length}`);
  console.log(`Total Real Accounts Protected: ${protectedAccountsList.length}`);
  console.log('\n--- PROTECTED REAL ACCOUNTS ---');
  protectedAccountsList.forEach(p => console.log(`✓ PROTECTED: ${p.uid} (${p.email})`));
  console.log('=================================================\n');
}

runCleanup().catch(console.error);
