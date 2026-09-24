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

function isTest(uid: string, email: string): boolean {
  const norm = (email || '').trim().toLowerCase();
  if (PROTECTED_REAL_EMAILS.has(norm) || PROTECTED_REAL_UIDS.has(uid)) {
    return false;
  }
  if (!norm || norm === 'no email' || norm === 'undefined') return true;

  const patterns = [
    'test',
    'example.com',
    'audit',
    'intruder',
    'qa_',
    'unapproved',
    'unverified',
    'gate_priv',
    'fresh_iso',
    'postfix_reg',
    'user_priv',
    'stripe_test',
    'director@zakir.ai',
    'analyst@zakir.ai',
    'compliance@zakir.ai',
    'user_a@zakir.ai',
    'user_b@zakir.ai'
  ];

  for (const p of patterns) {
    if (norm.includes(p) || uid.toLowerCase().includes(p)) return true;
  }

  return false;
}

async function runDirectCleanup() {
  console.log('=== RUNNING FAST PARALLEL TEST ACCOUNTS CLEANUP ===');

  let localCleaned = 0;
  let firestoreCleaned = 0;
  let authCleaned = 0;

  // 1. Clean local JSON DB first
  if (fs.existsSync('src/db_store.json')) {
    const ldb = JSON.parse(fs.readFileSync('src/db_store.json', 'utf8'));
    const beforeCount = (ldb.users || []).length;
    
    if (ldb.users) {
      ldb.users = ldb.users.filter((u: any) => !isTest(u.id || u.uid, u.email));
    }
    if (ldb.verification_codes) {
      ldb.verification_codes = ldb.verification_codes.filter((vc: any) => !isTest(vc.userId || vc.id, ''));
    }
    if (ldb.support_tickets) {
      ldb.support_tickets = ldb.support_tickets.filter((st: any) => !isTest(st.userId || '', st.userEmail || ''));
    }
    if (ldb.memories) {
      ldb.memories = ldb.memories.filter((m: any) => !isTest(m.userId || '', ''));
    }
    if (ldb.causal_graphs) {
      ldb.causal_graphs = ldb.causal_graphs.filter((cg: any) => !isTest(cg.userId || '', ''));
    }

    localCleaned = beforeCount - (ldb.users || []).length;
    fs.writeFileSync('src/db_store.json', JSON.stringify(ldb, null, 2), 'utf8');
    console.log(`Local Store Cleaned: ${localCleaned} test users removed.`);
  }

  // 2. Clean Firestore Users
  try {
    const snap = await adminDb.collection('users').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      if (isTest(doc.id, d.email)) {
        await adminDb.collection('users').doc(doc.id).delete().catch(() => {});
        firestoreCleaned++;
      }
    }
    console.log(`Firestore Cleaned: ${firestoreCleaned} test user documents deleted.`);
  } catch (e: any) {
    console.warn('Firestore warning:', e.message);
  }

  // 3. Clean Firebase Auth
  try {
    const listAuth = await adminAuth.listUsers(500);
    for (const u of listAuth.users) {
      if (isTest(u.uid, u.email || '')) {
        await adminAuth.deleteUser(u.uid).catch(() => {});
        authCleaned++;
      }
    }
    console.log(`Firebase Auth Cleaned: ${authCleaned} test accounts purged.`);
  } catch (e: any) {
    console.warn('Firebase Auth warning:', e.message);
  }

  // 4. Verify Remaining Users
  console.log('\n=== REMAINING PROTECTED REAL USERS ===');
  if (fs.existsSync('src/db_store.json')) {
    const ldb = JSON.parse(fs.readFileSync('src/db_store.json', 'utf8'));
    (ldb.users || []).forEach((u: any) => {
      console.log(`REAL USER: ${u.id || u.uid} | ${u.email} | ${u.role} | Status: ${u.accountStatus}`);
    });
  }
}

runDirectCleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
