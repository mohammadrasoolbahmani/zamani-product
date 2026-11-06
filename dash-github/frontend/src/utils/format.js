const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

export function faDigits(value) {
  return String(value ?? '').replace(/\d/g, (digit) => FA_DIGITS[Number(digit)])
}

export function toEnglishDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) => String(FA_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/٬/g, '')
    .replace(/,/g, '')
    .replace(/٫/g, '.')
}

export function parseNumericInput(value) {
  const normalized = toEnglishDigits(value).replace(/[^\d.-]/g, '')
  if (!normalized) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

export function formatNumber(value, options = {}) {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    grouping = true,
  } = options
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: grouping,
  }).format(number)
}

export function formatDecimal(value, maximumFractionDigits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const hasFraction = Math.abs(number % 1) > 0.0001
  return formatNumber(number, {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits,
  })
}

export function formatKg(value, { unit = true, compact = false } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (compact && number >= 1000) {
    const compactValue = formatDecimal(number / 1000, 1)
    return `${compactValue} هزار${unit ? ' کیلوگرم' : ''}`
  }
  return `${formatDecimal(number)}${unit ? ' کیلوگرم' : ''}`
}

export function formatPercent(value, { signed = false } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const prefix = signed && number > 0 ? '+' : ''
  return `${prefix}${formatDecimal(number, 1)}٪`
}

export function formatCompact(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (Math.abs(number) >= 1000) {
    return `${formatDecimal(number / 1000, 1)} هزار`
  }
  return formatNumber(number)
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0]}${parts[parts.length - 1][0]}`
}
