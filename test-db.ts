import pkg from "pg";
const { Client } = pkg;
import * as dotenv from "dotenv";

dotenv.config();

async function testConfig(config: any, label: string) {
  console.log(`\nTesting: ${label}`);
  const client = new Client(config);
  try {
    await client.connect();
    console.log(`Success! Result:`, (await client.query("SELECT NOW()")).rows);
    await client.end();
    return true;
  } catch (err: any) {
    console.error(`Failed:`, err.message || err);
    return false;
  }
}

async function run() {
  const host = process.env.SQL_HOST;
  const database = process.env.SQL_DB_NAME;
  const user = process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_ADMIN_PASSWORD;

  // Option 1: Standard socket configuration (no ssl field)
  await testConfig({
    host,
    user,
    password,
    database,
  }, "Standard config (no ssl field)");

  // Option 2: Config with ssl: false
  await testConfig({
    host,
    user,
    password,
    database,
    ssl: false,
  }, "With ssl: false");

  // Option 3: Standard app user instead of admin
  await testConfig({
    host,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database,
  }, "Standard app user (no ssl field)");
}

run();
