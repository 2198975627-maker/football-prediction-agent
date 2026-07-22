import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("auto-confirmed sign-up stores both server-only session cookies", async () => {
  const route = await source("app/api/auth/sign-up/route.ts");
  assert.match(route, /if \(data\.session\)/);
  assert.match(route, /cookies\.set\(ACCESS_COOKIE/);
  assert.match(route, /cookies\.set\(REFRESH_COOKIE/);
});

test("Stripe webhook delegates event claim and accounting to one database transaction", async () => {
  const route = await source("app/api/payments/webhook/route.ts");
  assert.match(route, /rpc\("process_football_checkout_completed"/);
  assert.doesNotMatch(route, /from\("football_webhook_events"\)/);
  assert.doesNotMatch(route, /from\("football_ledger"\)/);
});

test("payment migration rolls back incomplete webhook and settlement writes", async () => {
  const sql = await source("docs/supabase-production.sql");
  assert.match(sql, /on conflict \(event_id\) do nothing/);
  assert.match(sql, /raise exception 'football payment order mismatch'/);
  assert.match(sql, /create or replace function public\.settle_football_payment_order/);
  assert.match(sql, /insert into public\.football_prediction_jobs/);
  assert.match(sql, /insert into public\.football_ledger/);
});

test("application settlement uses the atomic database function", async () => {
  const payments = await source("src/lib/payments.ts");
  assert.match(payments, /rpc\("settle_football_payment_order"/);
  assert.doesNotMatch(payments, /from\("football_ledger"\)/);
  assert.doesNotMatch(payments, /from\("football_prediction_jobs"\)/);
});
