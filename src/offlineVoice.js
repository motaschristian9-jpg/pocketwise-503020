let PocketVoice;
try {
  const cap = await import('@capacitor/core');
  PocketVoice = cap.registerPlugin('PocketVoice');
} catch {
  PocketVoice = {
    listen: async () => { throw new Error('Native voice is only available in Android.'); },
    consumeWidgetLaunch: async () => ({ launched: false })
  };
}
export { PocketVoice };

const NUMBER_MAP = {
  'piso': 1, 'usa': 1, 'isa': 1, 'one': 1,
  'duha': 2, 'dalawa': 2, 'dos': 2, 'two': 2,
  'tulo': 3, 'tatlo': 3, 'tres': 3, 'three': 3,
  'upat': 4, 'apat': 4, 'kwatro': 4, 'kuwatro': 4, 'four': 4,
  'lima': 5, 'singko': 5, 'five': 5,
  'unom': 6, 'anim': 6, 'sais': 6, 'six': 6,
  'pito': 7, 'syete': 7, 'siyete': 7, 'seven': 7,
  'walo': 8, 'otso': 8, 'eight': 8,
  'siyam': 9, 'nuebe': 9, 'nwebe': 9, 'nine': 9,
  'napulo': 10, 'sampu': 10, 'dyes': 10, 'diyes': 10, 'diez': 10, 'ten': 10,
  'onse': 11, 'dose': 12, 'trese': 13, 'katorse': 14, 'kinse': 15, 'kinsi': 15,
  'disisais': 16, 'disisyete': 17, 'disiotso': 18, 'disinwebe': 19,
  'baynte': 20, 'bente': 20, 'twenty': 20,
  'traynta': 30, 'trenta': 30, 'thirty': 30,
  'kwarenta': 40, 'kuwarenta': 40, 'forty': 40,
  'singkwenta': 50, 'singkuwenta': 50, 'fifty': 50,
  'sesenta': 60, 'sixty': 60,
  'setenta': 70, 'seventy': 70,
  'otsenta': 80, 'eighty': 80,
  'nobenta': 90, 'ninety': 90,
  'syento': 100, 'siyento': 100, 'gatos': 100, 'daan': 100, 'hundred': 100,
  'kinyentos': 500,
  'libo': 1000, 'mil': 1000, 'thousand': 1000
};

export function extractAmount(text) {
  const q = String(text || '').toLowerCase().replace(/[,]/g, ' ');
  // 1. Literal digits
  const digitMatch = q.match(/(?:₱|php\s*)?(\d+(?:\.\d{1,2})?)\s*(?:pesos?|php)?\b/);
  if (digitMatch && Number(digitMatch[1]) > 0) {
    return { amount: Number(digitMatch[1]), rawMatch: digitMatch[0] };
  }

  // 2. Word numbers (Bisaya, Tagalog, Spanish, English)
  const words = q.split(/\s+/);
  let total = 0, current = 0, found = false, matched = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[.!?]/g, '');
    if (['ka', 'y', 'i', 'pesos', 'peso', 'php', 'nga'].includes(w)) {
      if (found) matched.push(words[i]);
      continue;
    }
    if (NUMBER_MAP[w] !== undefined) {
      found = true;
      matched.push(words[i]);
      const val = NUMBER_MAP[w];
      if (val === 100 || val === 1000) {
        current = (current || 1) * val;
        total += current;
        current = 0;
      } else if (val === 500) {
        total += 500;
      } else {
        current += val;
      }
    } else if (found) {
      break;
    }
  }
  total += current;
  if (found && total > 0) {
    return { amount: total, rawMatch: matched.join(' ') };
  }
  return null;
}

export function parseVoiceCommand(raw) {
  const text = String(raw || '').trim();
  const q = text.toLowerCase().replace(/[,]/g, ' ');

  // 1. Confirmations & Cancellations
  const isConfirm = /\b(confirm|yes|save|i-save|kumpirma|kumpirmahin|oo|sige|padayon|itago|tara|ok|okay)\b/i.test(q);
  const isCancel = /\b(cancel|no|never mind|huwag|wag|ayaw|dili|kanselahin|undo|undang)\b/i.test(q);
  if (isCancel && !isConfirm) return { kind: 'cancel' };
  if (isConfirm && !isCancel && !/\b(pila|magkano|how much|balance)\b/i.test(q) && !extractAmount(q)) {
    return { kind: 'confirm' };
  }

  // 3. Delete guard
  if (/\b(delete|remove|erase|burahin|papasa|walaa|i-delete)\b/i.test(q)) {
    return { kind: 'unsupported', message: 'Deleting records by voice is not enabled. Please use the Activity screen to manage records.' };
  }

  // 4. Balance / Status Queries
  if (/\b(balance|how much|pila|magkano|nabilin|pabilin|nahibilin|natira|remaining|tagpila|kwarta|pila pa|unsay sulod)\b/i.test(q)) {
    return { kind: 'balance' };
  }

  // 5. Amount Extraction
  const extracted = extractAmount(q);
  if (!extracted) {
    return { kind: 'unsupported', message: 'Please include an amount, e.g.: "Niplete kog 25 pesos sa jeep" or "Allowance lima ka gatos".' };
  }
  const { amount, rawMatch } = extracted;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return { kind: 'unsupported', message: 'Please specify a valid amount under ₱1,000,000.' };
  }

  // 6. Semantic Intent: Income vs Expense
  const incomeRegex = /\b(income|allowance|baon|balon|sweldo|sahod|salary|sinweldo|dawat|nakadawat|nidawat|kadawat|hatag|nihatag|gihatag|gihatagan|padala|deposit|inflow)\b|sweldo|sahod|allowance|baon|balon/i;
  const expenseRegex = /\b(spent|spend|paid|pay|bought|buy|bayad|gasto|palit|nipalit|gipalit|nagasto|nibayad|gibayad|nabayran|kuha|gastos)\b|gasto|bayad|palit/i;

  const hasIncome = incomeRegex.test(q);
  const hasExpense = expenseRegex.test(q);

  // Essential Needs keywords
  const needsRegex = /\b(jeep|jeepney|bus|tricycle|trike|habal|habal-habal|angkas|mrt|lrt|plete|plite|pamasahe|fare|gas|gasolina|transport|transpo|pagkaon|kaon|sud-an|kan-on|bugas|canteen|paniudto|pamahaw|panihapon|lunch|breakfast|dinner|meal|meals|ulam|bigas|groceries|tubig|water|itlog|school|skwela|eskwelahan|tuition|project|print|xerox|photocopy|uniform|papel|ballpen|libro|book|amot|amotan|contribution|exam|medicine|tambal|medical|doctor|hospital|load|kuryente|rent|abang|boarding house|bh)\b/i;

  // Discretionary Wants keywords
  const wantsRegex = /\b(milk tea|milktea|kape|coffee|starbucks|snack|snacks|merienda|chichirya|treat|treats|samgyup|buffet|jollibee|mcdo|fries|ice cream|donut|game|games|skin|mobile legends|ml|valorant|steam|movie|sine|netflix|spotify|laag|gala|shopping|mall|clothes|sinina|sapatos|shoes|shopee|lazada|tiktok shop|party|tagay|inom|barkada)\b/i;

  const hasNeeds = needsRegex.test(q);
  const hasWants = wantsRegex.test(q);

  // Handle explicit Income
  if (hasIncome && !hasExpense) {
    let label = 'Allowance';
    if (/salary|sweldo|sahod/i.test(q)) label = 'Salary';
    else if (/mama/i.test(q)) label = 'Allowance gikan ni mama';
    else if (/papa/i.test(q)) label = 'Allowance gikan ni papa';
    else if (/balon|baon/i.test(q)) label = 'Baon';
    return { kind: 'action', action: { type: 'add_income', args: { amount, label } } };
  }

  // Handle Expense (either explicit verb or implied by category keywords)
  if (hasExpense || hasNeeds || hasWants) {
    if (hasNeeds === hasWants) {
      return { kind: 'unsupported', message: 'Is this for Needs (essentials) or Wants (treats/leisure)? Please enter it manually to avoid misclassification.' };
    }
    const bucket = hasNeeds ? 'needs' : 'wants';

    // Build a clean, meaningful label
    let cleanLabel = q
      .replace(rawMatch, '')
      .replace(/\b(i\s+)?(spent|spend|paid|bought|buy|expense|gasto|nagbayad|nibayad|nipalit|gipalit|gibayad|nabayran|kuha|kog|ko ug|ko og|ako ng|akong|ako)\b/gi, '')
      .replace(/\b(pesos?|php|ang|sa|para|para sa|sa akong|sa ako)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanLabel.length < 2) {
      cleanLabel = hasNeeds ? (/\b(plete|plite|fare|jeep)\b/i.test(q) ? 'Pasahe / Plete' : 'Needs expense') : 'Wants expense';
    } else {
      cleanLabel = cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1);
    }

    return {
      kind: 'action',
      action: {
        type: 'add_expense',
        args: { amount, bucket, label: cleanLabel.slice(0, 80) }
      }
    };
  }

  return { kind: 'unsupported', message: 'Could not recognize command. Try: "Plete sa jeep 20 pesos", "Allowance 500", or "Pila akong balance".' };
}
