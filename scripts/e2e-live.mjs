/**
 * End-to-end check against the live Supabase project, as an authenticated shop
 * owner. Creates one throwaway account, exercises the real RPCs, then deletes
 * the data it made.
 *
 *   node scripts/e2e-live.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const db = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  cond ? pass++ : fail++;
};
const rejects = async (name, p, expect) => {
  const { error } = await p;
  const msg = error?.message ?? '(no error raised)';
  ok(name, !!error && msg.toLowerCase().includes(expect.toLowerCase()), msg.slice(0, 80));
};

const s = Date.now();

async function main() {
  console.log('\n--- signup / session ---');
  const email = `dukasmart.e2e.${s}@mailinator.com`;
  const { data: up, error: upErr } = await db.auth.signUp({
    email, password: 'TestPass123!',
    options: { data: { username: `e2e${s}`, shop_name: 'E2E Shop', phone: '0754000000' } },
  });
  if (upErr || !up.session) {
    console.error('signup failed:', upErr?.message ?? 'no session returned');
    process.exit(2);
  }
  ok('session issued on signup', true);
  const uid = up.user.id;

  const { data: prof } = await db.from('user_profiles').select('*').eq('id', uid).single();
  ok('profile created by trigger', !!prof, prof?.shop_name);
  ok('metadata carried through', prof?.phone === '0754000000');

  console.log('\n--- username availability ---');
  ok('own username reported taken', (await db.rpc('username_available', { p_username: `e2e${s}` })).data === false);
  ok('unused username reported free', (await db.rpc('username_available', { p_username: `none${s}` })).data === true);

  console.log('\n--- inventory ---');
  const { data: cust } = await db.from('customers')
    .insert([{ user_id: uid, name: 'Asha', phone: '0755111222' }]).select().single();
  const { data: phone } = await db.from('products').insert([{
    user_id: uid, name: 'Redmi 13C', brand: 'Xiaomi', category: 'Phones',
    buying_price: 250000, selling_price: 320000, pieces: 0, is_serialized: true, warranty_days: 365,
  }]).select().single();
  const { data: cable } = await db.from('products').insert([{
    user_id: uid, name: 'USB-C Cable', brand: 'Oraimo', category: 'Accessories',
    buying_price: 3000, selling_price: 6000, pieces: 40,
  }]).select().single();
  ok('products created', !!phone && !!cable);

  const imeis = [0, 1, 2].map(i => String(35900000000000 + (s % 100000) * 10 + i));
  const { data: units, error: uErr } = await db.from('product_units')
    .insert(imeis.map(imei => ({ user_id: uid, product_id: phone.id, imei, cost: 250000 }))).select();
  ok('3 IMEI units registered', units?.length === 3, uErr?.message ?? '');
  ok('trigger derived pieces', (await db.from('products').select('pieces').eq('id', phone.id).single()).data?.pieces === 3);
  await rejects('duplicate IMEI rejected',
    db.from('product_units').insert([{ user_id: uid, product_id: phone.id, imei: imeis[0], cost: 1 }]), 'duplicate key');

  console.log('\n--- checkout ---');
  await rejects('phone without IMEI refused', db.rpc('complete_sale', {
    p_total: 320000, p_cash_received: 320000,
    p_items: [{ productId: phone.id, quantity: 1, price: 320000 }],
    p_customer_id: null, p_loan_amount: 0, p_customer_name: 'Walk-in',
    p_payment_method: 'cash', p_payment_reference: null,
  }), 'IMEI unit');

  const { data: saleId, error: sErr } = await db.rpc('complete_sale', {
    p_total: 320000, p_cash_received: 320000,
    p_items: [{ productId: phone.id, quantity: 1, price: 320000, unitIds: [units[0].id] }],
    p_customer_id: cust.id, p_loan_amount: 0, p_customer_name: 'Asha',
    p_payment_method: 'mpesa', p_payment_reference: `QGH${s}`,
  });
  ok('M-Pesa handset sale', !!saleId, sErr?.message ?? '');

  const { data: sale } = await db.from('sales').select('*').eq('id', saleId).single();
  ok('payment method stored', sale?.payment_method === 'mpesa');
  ok('payment reference stored', sale?.payment_reference === `QGH${s}`);
  ok('loyalty points awarded', sale?.points_awarded === 320, `points=${sale?.points_awarded}`);

  const { data: sold } = await db.from('product_units').select('*').eq('id', units[0].id).single();
  ok('unit marked sold', sold?.status === 'sold');
  ok('warranty date set', !!sold?.warranty_until, sold?.warranty_until ?? '');
  ok('stock fell to 2', (await db.from('products').select('pieces').eq('id', phone.id).single()).data?.pieces === 2);

  await rejects('reselling same IMEI refused', db.rpc('complete_sale', {
    p_total: 320000, p_cash_received: 320000,
    p_items: [{ productId: phone.id, quantity: 1, price: 320000, unitIds: [units[0].id] }],
    p_customer_id: null, p_loan_amount: 0, p_customer_name: null,
    p_payment_method: 'cash', p_payment_reference: null,
  }), 'no longer in stock');

  ok('split cash/credit sale', !!(await db.rpc('complete_sale', {
    p_total: 12000, p_cash_received: 5000,
    p_items: [{ productId: cable.id, quantity: 2, price: 6000 }],
    p_customer_id: cust.id, p_loan_amount: 7000, p_customer_name: 'Asha',
    p_payment_method: 'split', p_payment_reference: null,
  })).data);
  ok('loan balance updated', Number((await db.from('customers').select('loan_balance').eq('id', cust.id).single()).data?.loan_balance) === 7000);

  console.log('\n--- loss ---');
  const { data: lossId, error: lErr } = await db.rpc('record_loss', {
    p_product_id: phone.id, p_quantity: 1, p_reason: 'stolen', p_description: 'E2E', p_unit_ids: [units[1].id],
  });
  ok('handset written off', !!lossId, lErr?.message ?? '');
  ok('loss reduced stock to 1', (await db.from('products').select('pieces').eq('id', phone.id).single()).data?.pieces === 1);

  console.log('\n--- return ---');
  const { data: item } = await db.from('sale_items').select('id').eq('sale_id', saleId).single();
  const { data: retId, error: rErr } = await db.rpc('process_return', {
    p_sale_item_id: item.id, p_quantity: 1, p_reason: 'changed mind', p_restock: true, p_unit_ids: [units[0].id],
  });
  ok('return processed', !!retId, rErr?.message ?? '');
  ok('handset back in stock', (await db.from('products').select('pieces').eq('id', phone.id).single()).data?.pieces === 2);
  ok('sale marked returned', (await db.from('sales').select('status').eq('id', saleId).single()).data?.status === 'returned');
  await rejects('over-return refused', db.rpc('process_return', {
    p_sale_item_id: item.id, p_quantity: 1, p_reason: 'again', p_restock: true, p_unit_ids: [units[0].id],
  }), 'more than was sold');

  console.log('\n--- lookup & isolation ---');
  const { data: found } = await db.from('product_units').select('*, product:products(name)').ilike('imei', `%${imeis[0]}%`);
  ok('IMEI lookup finds handset', found?.length === 1, found?.[0]?.imei);
  ok('RLS hides other shops', ((await db.from('products').select('id').neq('user_id', uid)).data?.length ?? 0) === 0);

  console.log('\n--- cleanup ---');
  for (const t of ['sale_returns','losses','sale_items','sales','product_units','products','customer_loan_history','customers'])
    await db.from(t).delete().eq('user_id', uid);
  ok('test data removed', ((await db.from('products').select('id')).data?.length ?? 0) === 0);
  console.log(`\n  auth user left behind: ${email}`);

  console.log(`\n${'='.repeat(44)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(44)}\n`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(3); });
