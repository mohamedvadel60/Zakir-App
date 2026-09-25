import { 
  PLAN_LIMITS, 
  normalizeSubscriptionPlan, 
  getPlanLimits, 
  canPlanInviteMembers, 
  getPlanMaxTeamMembers 
} from "../src/lib/pricingConfig.js";
import { 
  getUserProfileServer, 
  verifyUserAccess, 
  computeStrictVerificationState 
} from "../src/middleware/auth.js";
import { getWorkspaceOccupancy, runWithWorkspaceLock } from "../server.js";
import fs from "fs";
import path from "path";

// Helper to seed test data into local DB for testing
function getTestDb() {
  const dbPath = path.join(process.cwd(), "src", "db_store.json");
  if (fs.existsSync(dbPath)) {
    return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  }
  return { users: [], invitations: [], risk_alerts: [], files: [] };
}

function saveTestDb(data: any) {
  const dbPath = path.join(process.cwd(), "src", "db_store.json");
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
}

let passedTests = 0;
let totalTests = 0;

function assertTest(name: string, condition: boolean, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${name}`);
  } else {
    console.error(`❌ [FAIL] ${name}`);
    if (details) console.error("Details:", details);
    throw new Error(`Test assertion failed: ${name}`);
  }
}

async function runTestSuite() {
  console.log("===============================================================");
  console.log("🚀 STARTING STRICT TEAM LIMITS & ENTITLEMENTS TEST SUITE");
  console.log("===============================================================\n");

  const originalDb = getTestDb();

  try {
    // -------------------------------------------------------------
    // 1. STARTER PLAN TESTS (Limit = 0 members / no invitations)
    // -------------------------------------------------------------
    console.log("--- 1. STARTER PLAN LIMIT TESTS ---");
    assertTest("Starter plan max seats is 0", getPlanMaxTeamMembers("Starter") === 0);
    assertTest("Starter plan allowsTeamInvitations is false", canPlanInviteMembers("Starter") === false);

    const starterWsId = "ws_starter_test_001";
    const starterCeoId = "usr_ceo_starter_001";

    const db1 = getTestDb();
    db1.users = (db1.users || []).filter((u: any) => u.workspaceId !== starterWsId);
    db1.invitations = (db1.invitations || []).filter((i: any) => i.workspaceId !== starterWsId);

    db1.users.push({
      id: starterCeoId,
      uid: starterCeoId,
      email: "ceo.starter@test-zakir.com",
      role: "CEO",
      subscriptionPlan: "Starter",
      subscriptionStatus: "Active",
      workspaceId: starterWsId,
      accountStatus: "APPROVED",
      isVerified: true
    });
    saveTestDb(db1);

    const starterOccupancy = await getWorkspaceOccupancy(starterWsId, starterCeoId);
    assertTest("Starter workspace occupancy plan is Starter", starterOccupancy.plan === "Starter");
    assertTest("Starter workspace maxSeats is 0", starterOccupancy.maxSeats === 0);
    assertTest("Starter workspace allowsInvitations is false", starterOccupancy.allowsInvitations === false);
    assertTest("Starter workspace isAtLimit is true (0 >= 0)", starterOccupancy.isAtLimit === true);

    // -------------------------------------------------------------
    // 2. PROFESSIONAL PLAN TESTS (Limit = 5 members)
    // -------------------------------------------------------------
    console.log("\n--- 2. PROFESSIONAL PLAN LIMIT TESTS ---");
    assertTest("Professional plan max seats is 5", getPlanMaxTeamMembers("Professional") === 5);
    assertTest("Professional plan allowsTeamInvitations is true", canPlanInviteMembers("Professional") === true);

    const proWsId = "ws_pro_test_002";
    const proCeoId = "usr_ceo_pro_002";

    const db2 = getTestDb();
    db2.users = (db2.users || []).filter((u: any) => u.workspaceId !== proWsId);
    db2.invitations = (db2.invitations || []).filter((i: any) => i.workspaceId !== proWsId);

    db2.users.push({
      id: proCeoId,
      uid: proCeoId,
      email: "ceo.pro@test-zakir.com",
      role: "CEO",
      subscriptionPlan: "Professional",
      subscriptionStatus: "Active",
      workspaceId: proWsId,
      accountStatus: "APPROVED",
      isVerified: true
    });
    saveTestDb(db2);

    let proOccupancy = await getWorkspaceOccupancy(proWsId, proCeoId);
    assertTest("Professional initial occupancy is 0 / 5", proOccupancy.occupiedSeats === 0 && proOccupancy.maxSeats === 5);
    assertTest("Professional allows invitations initially", proOccupancy.allowsInvitations === true && !proOccupancy.isAtLimit);

    // Add 3 active members + 2 pending invitations = 5 seats
    const dbProFill = getTestDb();
    dbProFill.users.push(
      { id: "usr_pro_m1", uid: "usr_pro_m1", email: "pro.m1@test.com", role: "Analyst", workspaceId: proWsId, accountStatus: "APPROVED", isEmailVerified: true, powers: { fileVault: true, memoryVault: true, riskRadar: false, marketIntel: false, settings: false } },
      { id: "usr_pro_m2", uid: "usr_pro_m2", email: "pro.m2@test.com", role: "Contributor", workspaceId: proWsId, accountStatus: "APPROVED", isEmailVerified: true, powers: { fileVault: false, memoryVault: true, riskRadar: true, marketIntel: true, settings: false } },
      { id: "usr_pro_m3", uid: "usr_pro_m3", email: "pro.m3@test.com", role: "Risk Auditor", workspaceId: proWsId, accountStatus: "APPROVED", isEmailVerified: true, powers: { fileVault: true, memoryVault: true, riskRadar: true, marketIntel: false, settings: false } }
    );
    dbProFill.invitations.push(
      { email: "pro.inv4@test.com", workspaceId: proWsId, status: "pending", token: "tok_4" },
      { email: "pro.inv5@test.com", workspaceId: proWsId, status: "pending", token: "tok_5" }
    );
    saveTestDb(dbProFill);

    proOccupancy = await getWorkspaceOccupancy(proWsId, proCeoId);
    assertTest("Professional occupancy accurately counts members + pending invites (5 / 5)", proOccupancy.occupiedSeats === 5);
    assertTest("Professional isAtLimit is true when 5 seats are occupied", proOccupancy.isAtLimit === true);
    assertTest("Professional remainingSeats is 0", proOccupancy.remainingSeats === 0);

    // Resending existing invitation (pro.inv4@test.com) should not exceed 5 seats
    assertTest("Resending existing invitation email is recognized as already occupying seat", proOccupancy.distinctOccupiedEmails.has("pro.inv4@test.com"));

    // Attempting a 6th unique member must be blocked
    const isNewEmailAllowedOnPro = !proOccupancy.distinctOccupiedEmails.has("pro.inv6@test.com") && proOccupancy.occupiedSeats < proOccupancy.maxSeats;
    assertTest("6th invitation on Professional plan is strictly REJECTED (false)", isNewEmailAllowedOnPro === false);

    // -------------------------------------------------------------
    // 3. ENTERPRISE PLAN TESTS (Limit = 15 members)
    // -------------------------------------------------------------
    console.log("\n--- 3. ENTERPRISE PLAN LIMIT TESTS ---");
    assertTest("Enterprise plan max seats is 15", getPlanMaxTeamMembers("Enterprise") === 15);
    assertTest("Enterprise plan allowsTeamInvitations is true", canPlanInviteMembers("Enterprise") === true);

    const entWsId = "ws_ent_test_003";
    const entCeoId = "usr_ceo_ent_003";

    const db3 = getTestDb();
    db3.users = (db3.users || []).filter((u: any) => u.workspaceId !== entWsId);
    db3.invitations = (db3.invitations || []).filter((i: any) => i.workspaceId !== entWsId);

    db3.users.push({
      id: entCeoId,
      uid: entCeoId,
      email: "ceo.ent@test-zakir.com",
      role: "CEO",
      subscriptionPlan: "Enterprise",
      subscriptionStatus: "Active",
      workspaceId: entWsId,
      accountStatus: "APPROVED",
      isVerified: true
    });

    // Populate 14 members
    for (let i = 1; i <= 14; i++) {
      db3.users.push({
        id: `usr_ent_m${i}`,
        uid: `usr_ent_m${i}`,
        email: `ent.m${i}@test.com`,
        role: "Contributor",
        workspaceId: entWsId,
        accountStatus: "APPROVED",
        isEmailVerified: true,
        powers: { fileVault: true, memoryVault: true, riskRadar: true, marketIntel: true, settings: false }
      });
    }
    saveTestDb(db3);

    let entOccupancy = await getWorkspaceOccupancy(entWsId, entCeoId);
    assertTest("Enterprise occupancy at 14/15 allows 15th member", entOccupancy.occupiedSeats === 14 && entOccupancy.remainingSeats === 1 && !entOccupancy.isAtLimit);

    // Add 15th member
    const dbEnt15 = getTestDb();
    dbEnt15.invitations.push({
      email: "ent.inv15@test.com",
      workspaceId: entWsId,
      status: "pending",
      token: "tok_15"
    });
    saveTestDb(dbEnt15);

    entOccupancy = await getWorkspaceOccupancy(entWsId, entCeoId);
    assertTest("Enterprise occupancy reaches exactly 15 / 15", entOccupancy.occupiedSeats === 15 && entOccupancy.isAtLimit === true);

    const is16thAllowedOnEnt = !entOccupancy.distinctOccupiedEmails.has("ent.m16@test.com") && entOccupancy.occupiedSeats < entOccupancy.maxSeats;
    assertTest("16th invitation on Enterprise plan is strictly REJECTED (false)", is16thAllowedOnEnt === false);

    // -------------------------------------------------------------
    // 4. ENTITLEMENT INHERITANCE & RBAC PERMISSION SEPARATION TESTS
    // -------------------------------------------------------------
    console.log("\n--- 4. ENTITLEMENT INHERITANCE & RBAC SEPARATION TESTS ---");
    // Pro workspace member profile fetch
    const proMemberProfile = await getUserProfileServer("usr_pro_m1", "pro.m1@test.com");
    assertTest("Team member inherits Professional subscriptionPlan from workspace CEO", proMemberProfile.subscriptionPlan === "Professional");
    assertTest("Team member inherits Active subscriptionStatus from workspace CEO", proMemberProfile.subscriptionStatus === "Active");
    assertTest("Team member role remains Contributor / Analyst (NOT escalated to CEO)", proMemberProfile.role === "Analyst");
    assertTest("Team member ID and email are preserved", proMemberProfile.id === "usr_pro_m1" && proMemberProfile.email === "pro.m1@test.com");

    const accessResult = await verifyUserAccess("usr_pro_m1", "pro.m1@test.com");
    assertTest("Team member passes access verification via inherited subscription", accessResult.allowed === true && accessResult.hasActiveSubscription === true && accessResult.activePlan === "Professional");
    assertTest("Team member is NOT granted platform admin privileges", accessResult.isAdmin === false);

    // Test member individual powers
    const m1Powers = proMemberProfile.powers;
    assertTest("Member 1 has fileVault=true as assigned by CEO", m1Powers.fileVault === true);
    assertTest("Member 1 has marketIntel=false as assigned by CEO", m1Powers.marketIntel === false);

    const m2Profile = await getUserProfileServer("usr_pro_m2", "pro.m2@test.com");
    assertTest("Member 2 has marketIntel=true as assigned by CEO", m2Profile.powers.marketIntel === true);
    assertTest("Member 2 has fileVault=false as assigned by CEO", m2Profile.powers.fileVault === false);

    // -------------------------------------------------------------
    // 5. WORKSPACE ISOLATION TESTS
    // -------------------------------------------------------------
    console.log("\n--- 5. WORKSPACE ISOLATION TESTS ---");
    const wsA_CEO = "usr_ceo_wsA";
    const wsB_CEO = "usr_ceo_wsB";
    const wsA_Member = "usr_mem_wsA";

    const dbIso = getTestDb();
    dbIso.users.push(
      { id: wsA_CEO, uid: wsA_CEO, email: "ceo.wsA@test.com", role: "CEO", subscriptionPlan: "Enterprise", subscriptionStatus: "Active", workspaceId: "ws_A", accountStatus: "APPROVED", isEmailVerified: true },
      { id: wsB_CEO, uid: wsB_CEO, email: "ceo.wsB@test.com", role: "CEO", subscriptionPlan: "Starter", subscriptionStatus: "Active", workspaceId: "ws_B", accountStatus: "APPROVED", isEmailVerified: true },
      { id: wsA_Member, uid: wsA_Member, email: "mem.wsA@test.com", role: "Contributor", workspaceId: "ws_A", accountStatus: "APPROVED", isEmailVerified: true, powers: { fileVault: true, memoryVault: true, riskRadar: false, marketIntel: false, settings: false } }
    );
    saveTestDb(dbIso);

    const memberAProfile = await getUserProfileServer(wsA_Member, "mem.wsA@test.com");
    assertTest("Member in Workspace A inherits Workspace A (Enterprise), not Workspace B", memberAProfile.subscriptionPlan === "Enterprise");
    assertTest("Workspace A occupancy is isolated from Workspace B", (await getWorkspaceOccupancy("ws_A", wsA_CEO)).occupiedSeats === 1);
    assertTest("Workspace B occupancy is isolated from Workspace A", (await getWorkspaceOccupancy("ws_B", wsB_CEO)).occupiedSeats === 0);

    // -------------------------------------------------------------
    // 6. PLAN DOWNGRADE / UPGRADE LIFECYCLE TESTS
    // -------------------------------------------------------------
    console.log("\n--- 6. PLAN DOWNGRADE / UPGRADE LIFECYCLE TESTS ---");
    // Downgrade Pro CEO to Starter
    const dbDowngrade = getTestDb();
    const ceoProToDowngrade = dbDowngrade.users.find((u: any) => u.id === proCeoId);
    if (ceoProToDowngrade) {
      ceoProToDowngrade.subscriptionPlan = "Starter";
    }
    saveTestDb(dbDowngrade);

    const downgradedOccupancy = await getWorkspaceOccupancy(proWsId, proCeoId);
    assertTest("Downgraded workspace reflects Starter plan", downgradedOccupancy.plan === "Starter");
    assertTest("Downgraded workspace blocks new invitations (allowsInvitations=false)", downgradedOccupancy.allowsInvitations === false);
    assertTest("Existing members are preserved on downgrade without destructive auto-deletion", downgradedOccupancy.occupiedSeats === 5);

    // Upgrade back to Enterprise
    const dbUpgrade = getTestDb();
    const ceoToUpgrade = dbUpgrade.users.find((u: any) => u.id === proCeoId);
    if (ceoToUpgrade) {
      ceoToUpgrade.subscriptionPlan = "Enterprise";
    }
    saveTestDb(dbUpgrade);

    const upgradedOccupancy = await getWorkspaceOccupancy(proWsId, proCeoId);
    assertTest("Upgraded workspace reflects Enterprise plan", upgradedOccupancy.plan === "Enterprise");
    assertTest("Upgraded workspace expands limit to 15 seats", upgradedOccupancy.maxSeats === 15);
    assertTest("Upgraded workspace allows 10 additional seats (15 - 5 = 10 remaining)", upgradedOccupancy.remainingSeats === 10 && upgradedOccupancy.isAtLimit === false);

    // -------------------------------------------------------------
    // 7. CONCURRENCY & RACE CONDITION TEST
    // -------------------------------------------------------------
    console.log("\n--- 7. CONCURRENCY & RACE CONDITION PROTECTION ---");
    let concurrentExecutionOrder: number[] = [];
    await Promise.all([
      runWithWorkspaceLock("test_lock_ws", async () => {
        await new Promise(r => setTimeout(r, 50));
        concurrentExecutionOrder.push(1);
      }),
      runWithWorkspaceLock("test_lock_ws", async () => {
        await new Promise(r => setTimeout(r, 10));
        concurrentExecutionOrder.push(2);
      })
    ]);
    assertTest("runWithWorkspaceLock executes critical sections sequentially", concurrentExecutionOrder[0] === 1 && concurrentExecutionOrder[1] === 2);

    console.log("\n===============================================================");
    console.log(`🎉 ALL ${passedTests} / ${totalTests} TESTS PASSED PERFECTLY!`);
    console.log("===============================================================");
  } finally {
    // Restore original DB state
    saveTestDb(originalDb);
  }
}

runTestSuite().catch((err) => {
  console.error("FATAL TEST SUITE FAILURE:", err);
  process.exit(1);
});
