import { registerPlugin } from '@capacitor/core';
export const PocketVoice = registerPlugin('PocketVoice');

// Deterministic, intentionally narrow. Unrecognized or ambiguous commands never write data.
export function parseVoiceCommand(raw){
  const text=String(raw||'').trim();
  const q=text.toLowerCase().replace(/[,]/g,'');
  if(/^(confirm|yes confirm|save it|kumpirma|kumpirmahin)[.! ]*$/.test(q))return {kind:'confirm'};
  if(/^(cancel|no cancel|never mind|huwag|kanselahin)[.! ]*$/.test(q))return {kind:'cancel'};
  if(/\b(delete|remove|erase|burahin)\b/.test(q))return {kind:'unsupported',message:'Deleting records by voice is not enabled yet. Use Activity to select the exact transaction.'};
  if(/\b(balance|how much|remaining|natira)\b/.test(q))return {kind:'balance'};
  const m=q.match(/(?:₱|php\s*)?(\d+(?:\.\d{1,2})?)\s*(?:pesos?|php)?\b/);
  if(!m)return {kind:'unsupported',message:'Please include an amount, for example: I spent 35 pesos on jeepney fare.'};
  const amount=Number(m[1]);
  if(!Number.isFinite(amount)||amount<=0||amount>1000000)return {kind:'unsupported',message:'Please say a valid amount.'};
  const income=/\b(add income|income|received|earned|salary|allowance|sweldo|sahod|nakadawat)\b/.test(q);
  const expense=/\b(spent|spend|paid|expense|bought|buy|bayad|gasto|palit|nagbayad)\b/.test(q);
  if(income===expense)return {kind:'unsupported',message:'Say either “received” for income or “spent” for an expense.'};
  if(income)return {kind:'action',action:{type:'add_income',args:{amount,label:/allowance/.test(q)?'Allowance':/salary|sahod|sweldo/.test(q)?'Salary':'Voice income'}}};
  const needs=/\b(jeep|jeepney|fare|transport|bus|school|tuition|medicine|medical|groceries|rice|pagkaon|pamasahe|plite)\b/.test(q);
  const wants=/\b(movie|game|snack|treat|entertainment|shopping|coffee|milk tea|milktea)\b/.test(q);
  if(needs===wants)return {kind:'unsupported',message:'Is this Needs or Wants? Please enter it manually to avoid misclassification.'};
  const label=q.replace(/(?:₱|php\s*)?\d+(?:\.\d{1,2})?\s*(?:pesos?|php)?/,'').replace(/^(i\s+)?(spent|paid|bought|buy|expense|nagbayad|gasto)\s*/,'').trim().slice(0,80)||'Voice expense';
  return {kind:'action',action:{type:'add_expense',args:{amount,bucket:needs?'needs':'wants',label}}};
}
