import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand, extractAmount } from '../src/offlineVoice.js';

test('extractAmount: digits and Bisaya/Tagalog/Spanish words', () => {
  assert.equal(extractAmount('45 pesos')?.amount, 45);
  assert.equal(extractAmount('₱120.50')?.amount, 120.5);
  assert.equal(extractAmount('baynte pesos')?.amount, 20);
  assert.equal(extractAmount('baynte singko pesos')?.amount, 25);
  assert.equal(extractAmount('singkwenta pesos')?.amount, 50);
  assert.equal(extractAmount('usa ka gatos pesos')?.amount, 100);
  assert.equal(extractAmount('lima ka gatos')?.amount, 500);
  assert.equal(extractAmount('dos mil pesos')?.amount, 2000);
});

test('parseVoiceCommand: Bisaya income phrases', () => {
  // Variations of income intent
  const r1 = parseVoiceCommand('Nidawat kog allowance lima ka gatos gikan ni mama');
  assert.equal(r1.kind, 'action');
  assert.equal(r1.action.type, 'add_income');
  assert.equal(r1.action.args.amount, 500);
  assert.match(r1.action.args.label, /mama/i);

  const r2 = parseVoiceCommand('Nihatag si papa ug 300 pesos pang baon');
  assert.equal(r2.kind, 'action');
  assert.equal(r2.action.type, 'add_income');
  assert.equal(r2.action.args.amount, 300);

  const r3 = parseVoiceCommand('Nakasweldo kog dos mil pesos');
  assert.equal(r3.kind, 'action');
  assert.equal(r3.action.args.amount, 2000);
  assert.equal(r3.action.args.label, 'Salary');
});

test('parseVoiceCommand: Bisaya expense phrases (Needs vs Wants)', () => {
  // Needs: Plete (jeep fare) without explicit "spent" verb
  const r1 = parseVoiceCommand('Plete sa modern jeep baynte kwatro pesos');
  assert.equal(r1.kind, 'action');
  assert.equal(r1.action.type, 'add_expense');
  assert.equal(r1.action.args.bucket, 'needs');
  assert.equal(r1.action.args.amount, 24);

  // Needs: Paniudto sa canteen (lunch)
  const r2 = parseVoiceCommand('Nipalit kog paniudto sa canteen kwarenta pesos');
  assert.equal(r2.kind, 'action');
  assert.equal(r2.action.args.bucket, 'needs');
  assert.equal(r2.action.args.amount, 40);

  // Wants: Milk tea with crush
  const r3 = parseVoiceCommand('Nipalit mig milk tea ni crush 120 pesos');
  assert.equal(r3.kind, 'action');
  assert.equal(r3.action.args.bucket, 'wants');
  assert.equal(r3.action.args.amount, 120);

  // Wants: Coffee
  const r4 = parseVoiceCommand('Kape sa starbucks singkwenta pesos');
  assert.equal(r4.kind, 'action');
  assert.equal(r4.action.args.bucket, 'wants');
  assert.equal(r4.action.args.amount, 50);
});

test('parseVoiceCommand: Conversational intent (Balance, Confirm, Cancel)', () => {
  assert.equal(parseVoiceCommand('Pila pay nabilin sa akong kwarta?').kind, 'balance');
  assert.equal(parseVoiceCommand('Pila pa akong needs?').kind, 'balance');
  assert.equal(parseVoiceCommand('Magkano pa natira?').kind, 'balance');

  assert.equal(parseVoiceCommand('Sige i-save na').kind, 'confirm');
  assert.equal(parseVoiceCommand('Kumpirma').kind, 'confirm');
  assert.equal(parseVoiceCommand('Padayon').kind, 'confirm');

  assert.equal(parseVoiceCommand('Ayaw nalang').kind, 'cancel');
  assert.equal(parseVoiceCommand('Dili').kind, 'cancel');
  assert.equal(parseVoiceCommand('Huwag').kind, 'cancel');
});
