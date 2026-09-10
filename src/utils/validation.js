/**
 * Mozambique mobile numbers.
 * Common prefixes:
 *   Vodacom: 84, 85
 *   Movitel: 86, 87
 *   Tmcel/mCel: 82, 83
 * Full international: +258 + 9 digits
 */
function normalizeMzPhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('258') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 9 && /^[28]/.test(digits)) {
    return `+258${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+258${digits.slice(1)}`;
  }
  return null;
}

function isValidMzPhone(input) {
  const normalized = normalizeMzPhone(input);
  if (!normalized) return false;
  const local = normalized.slice(4); // 9 digits
  return /^[2-9]\d{8}$/.test(local);
}

function guessOperatorFromPhone(phone) {
  const normalized = normalizeMzPhone(phone);
  if (!normalized) return null;
  const prefix = normalized.slice(4, 6);
  if (['84', '85'].includes(prefix)) return 'Vodacom';
  if (['86', '87'].includes(prefix)) return 'Movitel';
  if (['82', '83'].includes(prefix)) return 'Tmcel';
  return null;
}

function isValidAmount(amount, { min = 10, max = 5000 } = {}) {
  const n = Number(amount);
  return Number.isFinite(n) && n >= min && n <= max;
}

module.exports = {
  normalizeMzPhone,
  isValidMzPhone,
  guessOperatorFromPhone,
  isValidAmount,
};
