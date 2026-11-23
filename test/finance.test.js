import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, split, cents, pesos, addIncome, addExpense, transfer, stats, balances } from '../src/finance.js';

test('50/30/20 split arithmetic', () => {
  // 100 pesos = 10000 cents
  const s1 = split(10000);
  assert.equal(s1.needs, 5000);
  assert.equal(s1.wants, 3000);
  assert.equal(s1.savings, 2000);

  // Odd cents: remainder should safely fall to savings
  const s2 = split(101);
  assert.equal(s2.needs, 50);
  assert.equal(s2.wants, 30);
  assert.equal(s2.savings, 21);
  assert.equal(s2.needs + s2.wants + s2.savings, 101);
});

test('cent and peso formatting', () => {
  assert.equal(cents(100.5), 10050);
  assert.equal(cents('25.25'), 2525);
  const formatted = pesos(10050);
  assert.match(formatted, /100\.50/);
});

test('addIncome and expense validation', () => {
  let state = initial();
  // 1. Add 100 pesos
  state = addIncome(state, 10000, 'Allowance', '2026-11-20');
  let b = balances(state.entries);
  assert.equal(b.needs, 5000);
  assert.equal(b.wants, 3000);
  assert.equal(b.savings, 2000);

  // 2. Spend 20 pesos from Needs and 10 pesos from Wants
  state = addExpense(state, 2000, 'needs', 'Bus fare', '2026-11-20');
  state = addExpense(state, 1000, 'wants', 'Snacks', '2026-11-20');
  b = balances(state.entries);
  assert.equal(b.needs, 3000);
  assert.equal(b.wants, 2000);
  assert.equal(b.savings, 2000);

  // 3. Overspend attempt must throw
  assert.throws(() => addExpense(state, 3500, 'needs', 'Too much'), /Not enough needs balance/);
  // Negative amount must throw
  assert.throws(() => addExpense(state, -100, 'needs', 'Invalid'), /Enter a valid amount/);
  assert.throws(() => addIncome(state, -500, 'Invalid'), /Enter a valid amount/);
});

test('rollover calculation across calendar dates', () => {
  let state = initial();
  // Day 1: Add ₱100 (50/30/20 -> 50/30/20)
  state = addIncome(state, 10000, 'Day 1 Allowance', '2026-11-20');
  // Spend ₱20 from Needs, ₱10 from Wants -> Leftover: Needs ₱30, Wants ₱20, Savings ₱20
  state = addExpense(state, 2000, 'needs', 'Commute', '2026-11-20');
  state = addExpense(state, 1000, 'wants', 'Coffee', '2026-11-20');

  // Day 2 (later date): Add ₱100
  // Leftover pool: ₱30 + ₱20 = ₱50. Total pool = ₱50 + ₱100 = ₱150
  // ₱150 split: Needs ₱75, Wants ₱45, Savings ₱30
  // Existing savings was ₱20, so new savings = ₱20 + ₱30 = ₱50.
  state = addIncome(state, 10000, 'Day 2 Allowance', '2026-11-21');
  const b = balances(state.entries);
  assert.equal(b.needs, 7500);
  assert.equal(b.wants, 4500);
  assert.equal(b.savings, 5000);

  // Income summary should record actual earned income (₱200, not ₱250)
  const s = stats(state.entries);
  assert.equal(s.income, 20000);
  assert.equal(s.expenses, 3000);
  assert.deepEqual(s.balance, b);
});

test('savings transfer recording', () => {
  let state = initial();
  state = addIncome(state, 10000, 'Allowance', '2026-11-20'); // Savings = ₱20 (2000 cents)
  state = transfer(state, 1500, 'GCash', 'Emergency Fund');
  const b = balances(state.entries);
  assert.equal(b.savings, 500);

  const s = stats(state.entries);
  assert.equal(s.transfers, 1500);

  // Cannot transfer more than available
  assert.throws(() => transfer(state, 1000, 'Maya'), /Not enough savings balance/);
});
