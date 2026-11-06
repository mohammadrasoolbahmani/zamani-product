import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import { addDays, formatJalaliNumeric, todayISO } from '../frontend/src/utils/date.js'

const BASE = 'http://127.0.0.1:5173'
const OUT = path.resolve('../docs/screenshots')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ADMIN_USER = process.env.QA_ADMIN_USER || 'admin'
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || 'change-me'
const TODAY = todayISO()
const CUSTOM_START = addDays(TODAY, -2)

const report = {
  startedAt: new Date().toISOString(),
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  failedResponses: [],
  checks: [],
}

await fs.mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
  acceptDownloads: true,
})
const page = await context.newPage()
const api = context.request
page.setDefaultTimeout(15000)

page.on('console', (message) => {
  if (message.type() === 'error') {
    report.consoleErrors.push({ url: page.url(), text: message.text() })
  }
})
page.on('pageerror', (error) => report.pageErrors.push({ url: page.url(), text: error.message }))
page.on('response', (response) => {
  if (response.status() >= 500 || (response.status() === 401 && !response.url().includes('/token/'))) {
    report.failedResponses.push({ status: response.status(), url: response.url() })
  }
})

let accessToken = ''

async function shot(name, options = {}) {
  await waitForToasts()
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, ...options })
  report.screenshots.push(file)
}

async function waitForToasts(timeout = 7000) {
  const toasts = page.locator('[role="status"]')
  try {
    while ((await toasts.count()) > 0) {
      await toasts.first().waitFor({ state: 'detached', timeout })
    }
  } catch {
    // Best effort; screenshots remain useful if a toast is replaced.
  }
}

function check(name, ok, detail) {
  report.checks.push({ name, ok: Boolean(ok), ...(detail ? { detail } : {}) })
}

async function authorized(pathname, options = {}) {
  return api.fetch(`${BASE}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  })
}

async function createRecord({ date, product, amount, packages }) {
  const response = await authorized('/api/records/', {
    method: 'POST',
    data: {
      date,
      product,
      amount_kg: String(amount),
      packages_count: packages,
    },
  })
  if (!response.ok()) {
    throw new Error(`create record failed: ${response.status()} ${await response.text()}`)
  }
  return response.json()
}

async function cleanupRecords(ids = []) {
  if (!accessToken) return
  // فقط رکوردهای موقتی که همین آزمون ساخته حذف می‌شوند؛
  // سوابق واقعی کاربر دست‌نخورده می‌مانند.
  for (const id of ids) {
    const response = await authorized(`/api/records/${id}/`, { method: 'DELETE' })
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`cleanup record ${id} failed: ${response.status()}`)
    }
  }
}

async function statCardsText() {
  return page.locator('article').allInnerTexts()
}

function waitForStatsResponse() {
  return page.waitForResponse(
    (response) => response.url().includes('/api/stats/') && response.status() === 200,
    { timeout: 15000 },
  )
}

try {
  // --- Login / brand -------------------------------------------------
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'ورود به پنل مدیریت' }).waitFor()
  await page.waitForTimeout(700)
  check(
    'brand is ZAMANI BURGER on login',
    (await page.getByText('ZAMANI BURGER', { exact: true }).count()) > 0,
  )
  check(
    'login hero image is visible',
    await page.getByAltText('همبرگر و استیک تازه روی تخته چوبی').isVisible(),
  )
  await shot('01-login-desktop', { fullPage: true })

  await page.fill('#username', ADMIN_USER)
  await page.fill('#password', 'wrong-password')
  await page.locator('button[type="submit"]').click()
  await page.getByText('نام کاربری یا رمز عبور نادرست است.').waitFor()
  check('invalid credentials show a Persian error', true)

  // --- Sign in -------------------------------------------------------
  await page.fill('#password', ADMIN_PASSWORD)
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ])
  await page.getByRole('heading', { name: 'داشبورد مدیریت' }).waitFor()
  await page.getByText('فیلتر زمان تولید').waitFor()
  await page.getByText('تولید کل بازه').waitFor()
  await page.waitForTimeout(500)
  accessToken = await page.evaluate(() => localStorage.getItem('access_token'))
  check('access token is stored after login', Boolean(accessToken))

  const dashboardEmptyText = await page.locator('main').innerText()
  check('production-time card is removed', !dashboardEmptyText.includes('زمان تولید امروز'))
  check('plan-fulfilment card is removed', !dashboardEmptyText.includes('درصد تحقق برنامه'))
  check(
    'all period presets are available',
    (await page.getByRole('button', { name: 'روزانه', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'هفتگی', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'ماهانه', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'سالانه', exact: true }).count()) === 1,
  )
  check(
    'empty dashboard shows a clear empty state',
    await page.getByText('در این بازه تولیدی ثبت نشده').first().isVisible(),
  )

  // --- Create temporary data for period filters ----------------------
  const productsResponse = await authorized('/api/products/?active=1&page_size=100')
  const productsPayload = await productsResponse.json()
  const products = productsPayload.results ?? productsPayload
  if (products.length < 3) throw new Error('At least three active products are required for QA')

  const tempRecords = []
  tempRecords.push(
    await createRecord({
      date: TODAY,
      product: products[0].id,
      amount: 1000,
      packages: 100,
    }),
  )
  tempRecords.push(
    await createRecord({
      date: addDays(TODAY, -2),
      product: products[1].id,
      amount: 500,
      packages: 50,
    }),
  )
  tempRecords.push(
    await createRecord({
      date: addDays(TODAY, -10),
      product: products[2].id,
      amount: 700,
      packages: 70,
    }),
  )
  check('temporary period-test records created', tempRecords.length === 3)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('تولید کل بازه').waitFor()
  await page.waitForTimeout(600)

  async function expectTotal(label, expected, { fetch = true } = {}) {
    if (fetch) {
      const response = waitForStatsResponse()
      await page.getByRole('button', { name: label, exact: true }).click()
      await response
      await page.waitForTimeout(350)
    }
    const cards = await statCardsText()
    check(`period ${label} shows expected total`, cards[0]?.includes(expected), cards[0])
  }

  await expectTotal('روزانه', '۱٬۰۰۰', { fetch: false })
  await expectTotal('هفتگی', '۱٬۵۰۰')
  await expectTotal('ماهانه', '۲٬۲۰۰')
  await expectTotal('سالانه', '۲٬۲۰۰')

  const customResponse = waitForStatsResponse()
  await page.getByRole('button', { name: 'بازه دلخواه' }).click()
  const customInputs = page.locator('input[id^="dashboard-"]')
  await customInputs.nth(0).fill(formatJalaliNumeric(CUSTOM_START))
  await customInputs.nth(1).fill(formatJalaliNumeric(TODAY))
  await page.getByRole('button', { name: 'اعمال بازه' }).click()
  await customResponse
  await page.waitForTimeout(350)
  const customCards = await statCardsText()
  check('custom date range shows expected total', customCards[0]?.includes('۱٬۵۰۰'), customCards[0])
  check(
    'custom range label is shown',
    (await page.locator('section').first().innerText()).includes('بازه دلخواه'),
  )

  // --- Reports + CSV with temporary data -----------------------------
  await page.locator('aside').getByRole('link', { name: 'گزارش‌گیری' }).click()
  await page.waitForURL('**/reports')
  await page.getByRole('heading', { name: 'گزارش‌گیری تولید' }).waitFor()
  await page.getByText('میانگین تولید روزانه', { exact: true }).waitFor()
  const reportText = await page.locator('main').innerText()
  check('report no longer shows plan fulfilment', !reportText.includes('تحقق برنامه'))
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'خروجی CSV' }).click()
  const download = await downloadPromise
  check(
    'CSV report downloads with the new brand prefix',
    download.suggestedFilename().startsWith('zamaniburger-report-'),
    download.suggestedFilename(),
  )

  const excelDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'دانلود اکسل' }).click()
  const excelDownload = await excelDownloadPromise
  const excelPath = await excelDownload.path()
  const excelBytes = excelPath ? await fs.readFile(excelPath) : Buffer.alloc(0)
  check(
    'Excel report downloads with the expected name',
    excelDownload.suggestedFilename().startsWith('zamaniburger-production-') &&
      excelDownload.suggestedFilename().endsWith('.xlsx'),
    excelDownload.suggestedFilename(),
  )
  check(
    'Excel file has a valid XLSX zip signature',
    excelBytes.length > 4 &&
      excelBytes[0] === 0x50 &&
      excelBytes[1] === 0x4b &&
      excelBytes[2] === 0x03 &&
      excelBytes[3] === 0x04,
    `${excelBytes.length} bytes`,
  )

  // --- Production: UI create and delete ------------------------------
  await page.locator('aside').getByRole('link', { name: 'ثبت آمار تولید' }).click()
  await page.waitForURL('**/production')
  await page.getByRole('heading', { name: 'ثبت آمار تولید' }).waitFor()
  await page.fill('#production-amount', '987.65')
  await page.fill('#production-packages', '42')
  await page.getByRole('button', { name: 'ثبت اطلاعات' }).click()
  await page.getByText(/سابقه تولید «/).waitFor()
  await page.waitForTimeout(500)
  const firstRowText = await page.locator('.data-table tbody tr').first().innerText()
  check(
    'production record can be created from the UI',
    firstRowText.includes('۹۸۷') && firstRowText.includes('۴۲'),
    firstRowText.replace(/\s+/g, ' ').slice(0, 150),
  )
  await page.locator('.data-table tbody tr').first().getByRole('button', { name: /حذف سابقه/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'حذف', exact: true }).click()
  await page.getByText('سابقه تولید حذف شد.').waitFor()
  check('production record can be deleted from the UI', true)

  // --- Products: no sausage, CRUD -----------------------------------
  await page.locator('aside').getByRole('link', { name: 'مدیریت محصولات' }).click()
  await page.waitForURL('**/products')
  await page.getByRole('heading', { name: 'مدیریت محصولات' }).waitFor()
  await page.waitForTimeout(400)
  check('sausage product is removed', (await page.getByText('سوسیس', { exact: true }).count()) === 0)

  const testProduct = `محصول آزمایشی ${Date.now().toString().slice(-5)}`
  const editedProduct = `${testProduct} ویرایش‌شده`
  await page.getByRole('button', { name: 'افزودن محصول' }).first().click()
  await page.locator('#product-name').fill(testProduct)
  await page.getByRole('button', { name: 'ذخیره محصول' }).click()
  await page.getByText(`محصول «${testProduct}» ایجاد شد.`).waitFor()
  check('product can be created from the UI', true)

  let productRow = page.locator('tr', { hasText: testProduct })
  await productRow.getByRole('button', { name: 'ویرایش' }).click()
  await page.locator('#product-name').fill(editedProduct)
  await page.getByRole('button', { name: 'ذخیره محصول' }).click()
  await page.getByText('محصول به‌روزرسانی شد.').waitFor()
  check('product can be edited from the UI', true)

  productRow = page.locator('tr', { hasText: editedProduct })
  await productRow.getByRole('button', { name: /حذف محصول/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'حذف محصول' }).click()
  await page.getByText('محصول حذف شد.').waitFor()
  check(
    'temporary QA product is removed',
    (await page.getByText(editedProduct, { exact: true }).count()) === 0,
  )

  // --- Operators / settings -----------------------------------------
  await page.locator('aside').getByRole('link', { name: 'مدیریت تولیدکنندگان' }).click()
  await page.waitForURL('**/operators')
  await page.getByRole('heading', { name: 'مدیریت تولیدکنندگان' }).waitFor()
  check(
    'operators page lists the signed-in admin',
    await page.getByText('مدیر سیستم', { exact: true }).first().isVisible(),
  )

  await page.locator('aside').getByRole('link', { name: 'تنظیمات' }).click()
  await page.waitForURL('**/settings')
  await page.getByRole('heading', { name: 'تنظیمات' }).waitFor()
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
  await page.getByText('اطلاعات حساب به‌روزرسانی شد.').waitFor()
  const settingsText = await page.locator('main').innerText()
  check(
    'settings no longer expose plan or shift duration',
    !settingsText.includes('هدف تولید') && !settingsText.includes('مدت هر شیفت'),
  )

  // --- Refresh token -------------------------------------------------
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('access_token'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'داشبورد مدیریت' }).waitFor({ timeout: 15000 })
  check(
    'access token is refreshed automatically',
    await page.evaluate(() => Boolean(localStorage.getItem('access_token'))),
  )
  accessToken = await page.evaluate(() => localStorage.getItem('access_token'))

  // --- Clean up all test records -------------------------------------
  const createdIds = tempRecords.map((record) => record.id)
  await cleanupRecords(createdIds)
  const remaining = await (await authorized('/api/records/?page_size=100')).json()
  const leftovers = (remaining.results ?? []).filter((record) => createdIds.includes(record.id))
  check(
    'all temporary production records are removed',
    leftovers.length === 0,
    `leftovers=${leftovers.length}, total_records=${remaining.count}`,
  )

  // --- Final empty-state screenshots ---------------------------------
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'داشبورد مدیریت' }).waitFor()
  await page.getByText('در این بازه تولیدی ثبت نشده').first().waitFor()
  await page.waitForTimeout(800)
  await shot('02-dashboard-desktop', { fullPage: true })

  await page.locator('aside').getByRole('link', { name: 'ثبت آمار تولید' }).click()
  await page.waitForURL('**/production')
  await page.getByRole('heading', { name: 'ثبت آمار تولید' }).waitFor()
  await page.waitForTimeout(700)
  await shot('03-production-desktop', { fullPage: true })

  await page.locator('aside').getByRole('link', { name: 'گزارش‌گیری' }).click()
  await page.waitForURL('**/reports')
  await page.getByRole('heading', { name: 'گزارش‌گیری تولید' }).waitFor()
  await page.waitForTimeout(700)
  await shot('04-reports-desktop', { fullPage: true })

  await page.locator('aside').getByRole('link', { name: 'مدیریت محصولات' }).click()
  await page.waitForURL('**/products')
  await page.getByRole('heading', { name: 'مدیریت محصولات' }).waitFor()
  await page.waitForTimeout(500)
  await shot('05-products-desktop', { fullPage: true })

  await page.locator('aside').getByRole('link', { name: 'مدیریت تولیدکنندگان' }).click()
  await page.waitForURL('**/operators')
  await page.getByRole('heading', { name: 'مدیریت تولیدکنندگان' }).waitFor()
  await page.waitForTimeout(500)
  await shot('06-operators-desktop', { fullPage: true })

  await page.locator('aside').getByRole('link', { name: 'تنظیمات' }).click()
  await page.waitForURL('**/settings')
  await page.getByRole('heading', { name: 'تنظیمات' }).waitFor()
  await page.waitForTimeout(500)
  await shot('07-settings-desktop', { fullPage: true })

  // --- Responsive checks ---------------------------------------------
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const desktopOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  check('no horizontal overflow at 1280px', !desktopOverflow)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await shot('08-dashboard-mobile', { fullPage: true })
  const mobileMetrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    statColumns: getComputedStyle(document.querySelector('.grid.grid-cols-2')).gridTemplateColumns,
  }))
  check('mobile has no horizontal overflow', mobileMetrics.scrollWidth <= mobileMetrics.innerWidth + 1)
  check(
    'mobile KPI cards use two columns',
    mobileMetrics.statColumns.split(' ').length === 2,
    mobileMetrics.statColumns,
  )

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await mobilePage.getByRole('heading', { name: 'ورود به پنل مدیریت' }).waitFor()
  await mobilePage.waitForTimeout(600)
  const mobileFile = path.join(OUT, '09-login-mobile.png')
  await mobilePage.screenshot({ path: mobileFile, fullPage: true })
  report.screenshots.push(mobileFile)
  check(
    'mobile login has no horizontal overflow',
    (await mobilePage.evaluate(() => document.documentElement.scrollWidth)) <= 391,
  )
  await mobileContext.close()
} catch (error) {
  report.pageErrors.push({ url: page.url(), text: `SCRIPT: ${error.message}` })
  await shot('99-failure-state', { fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  try {
    await cleanupRecords()
  } catch {
    // The final database check is the source of truth.
  }
  report.finishedAt = new Date().toISOString()
  await fs.writeFile(path.join(OUT, 'qa-report.json'), JSON.stringify(report, null, 2), 'utf8')
  await browser.close()
}

console.log(JSON.stringify(report, null, 2))
