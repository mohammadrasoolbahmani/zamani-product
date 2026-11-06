import { faDigits, toEnglishDigits } from './format.js'

const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

const PERSIAN_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
]

const SHORT_WEEKDAYS = {
  0: 'یک‌شنبه',
  1: 'دوشنبه',
  2: 'سه‌شنبه',
  3: 'چهارشنبه',
  4: 'پنجشنبه',
  5: 'جمعه',
  6: 'شنبه',
}

function div(a, b) {
  return ~~(a / b)
}

function mod(a, b) {
  return a - ~~(a / b) * b
}

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
]

function jalCal(jy, withoutLeap = false) {
  const bl = BREAKS.length
  let gy = jy + 621
  let leapJ = -14
  let jp = BREAKS[0]
  let jump = 0
  let leap
  let leapG

  if (jy < jp || jy >= BREAKS[bl - 1]) {
    throw new Error('سال جلالی خارج از محدوده است.')
  }

  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }

  let n = jy - jp
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG

  if (!withoutLeap) {
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
    leap = mod(mod(n + 1, 33) - 1, 4)
    if (leap === -1) leap = 4
  }

  return { leap, gy, march }
}

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy, true)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

function d2j(jdn) {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy, false)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  let jm
  let jd

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31)
      jd = mod(k, 31) + 1
      return { jy, jm, jd }
    }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }

  jm = 7 + div(k, 30)
  jd = mod(k, 30) + 1
  return { jy, jm, jd }
}

export function isJalaliLeapYear(jy) {
  return jalCal(jy, false).leap === 0
}

export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isJalaliLeapYear(jy) ? 30 : 29
}

export function gregorianToJalali(date) {
  return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()))
}

export function jalaliToGregorian(jy, jm, jd) {
  const g = d2g(j2d(Number(jy), Number(jm), Number(jd)))
  return { gy: g.gy, gm: g.gm, gd: g.gd }
}

export function parseISODate(iso) {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toJalaliParts(iso) {
  const date = typeof iso === 'string' ? parseISODate(iso) : iso
  if (!date) return null
  return { ...gregorianToJalali(date), weekday: date.getDay() }
}

export function formatJalali(iso, { withWeekday = false, withYear = true } = {}) {
  const parts = toJalaliParts(iso)
  if (!parts) return '—'
  const datePart = withYear
    ? `${faDigits(parts.jd)} ${PERSIAN_MONTHS[parts.jm - 1]} ${faDigits(parts.jy)}`
    : `${faDigits(parts.jd)} ${PERSIAN_MONTHS[parts.jm - 1]}`
  return withWeekday ? `${PERSIAN_WEEKDAYS[parts.weekday]} ${datePart}` : datePart
}

export function formatJalaliNumeric(iso) {
  const parts = toJalaliParts(iso)
  if (!parts) return '—'
  return faDigits(
    `${parts.jy}/${String(parts.jm).padStart(2, '0')}/${String(parts.jd).padStart(2, '0')}`,
  )
}

export function isoToJalaliInput(iso) {
  return formatJalaliNumeric(iso)
}

export function formatShortWeekday(iso) {
  const date = parseISODate(iso)
  if (!date) return ''
  return SHORT_WEEKDAYS[date.getDay()]
}

export function formatWeekday(iso) {
  const date = parseISODate(iso)
  if (!date) return ''
  return PERSIAN_WEEKDAYS[date.getDay()]
}

export function jalaliInputToISO(value) {
  const normalized = toEnglishDigits(value)
    .trim()
    .replace(/[.\-\s]+/g, '/')
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized)
  if (!match) return null

  const jy = Number(match[1])
  const jm = Number(match[2])
  const jd = Number(match[3])
  if (jm < 1 || jm > 12 || jd < 1 || jd > jalaliMonthLength(jy, jm)) return null

  try {
    const g = jalaliToGregorian(jy, jm, jd)
    const iso = toISODate(new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0))
    const roundTrip = gregorianToJalali(parseISODate(iso))
    if (roundTrip.jy !== jy || roundTrip.jm !== jm || roundTrip.jd !== jd) return null
    return iso
  } catch {
    return null
  }
}

export function todayISO() {
  return toISODate(new Date())
}

export function addDays(iso, amount) {
  const date = parseISODate(iso)
  if (!date) return null
  date.setDate(date.getDate() + Number(amount))
  return toISODate(date)
}

export function startOfJalaliMonthISO(iso = todayISO()) {
  const parts = toJalaliParts(iso)
  const g = jalaliToGregorian(parts.jy, parts.jm, 1)
  return toISODate(new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0))
}

export function startOfJalaliYearISO(iso = todayISO()) {
  const parts = toJalaliParts(iso)
  const g = jalaliToGregorian(parts.jy, 1, 1)
  return toISODate(new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0))
}

export function startOfJalaliWeekISO(iso = todayISO()) {
  const date = parseISODate(iso)
  if (!date) return iso
  const daysSinceSaturday = (date.getDay() + 1) % 7
  date.setDate(date.getDate() - daysSinceSaturday)
  return toISODate(date)
}

export function getPeriodRange(period, iso = todayISO()) {
  if (period === 'daily') return { start: iso, end: iso }
  if (period === 'weekly') return { start: startOfJalaliWeekISO(iso), end: iso }
  if (period === 'monthly') return { start: startOfJalaliMonthISO(iso), end: iso }
  if (period === 'yearly') return { start: startOfJalaliYearISO(iso), end: iso }
  return { start: iso, end: iso }
}

export function daysBetweenISO(start, end) {
  const from = parseISODate(start)
  const to = parseISODate(end)
  if (!from || !to) return 0
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.floor((utcTo - utcFrom) / 86400000) + 1
}

export function formatJalaliMonth(iso) {
  const parts = toJalaliParts(iso)
  if (!parts) return '—'
  return PERSIAN_MONTHS[parts.jm - 1]
}

export function formatJalaliRange(start, end) {
  if (!start && !end) return '—'
  if (!end || start === end) return formatJalali(start)
  return `${formatJalali(start)} تا ${formatJalali(end)}`
}

export function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
