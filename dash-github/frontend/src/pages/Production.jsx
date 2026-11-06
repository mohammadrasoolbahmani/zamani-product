import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LuBeef,
  LuCalendarDays,
  LuCheck,
  LuChevronDown,
  LuClipboardList,
  LuEye,
  LuLoaderCircle,
  LuPackage,
  LuPencilLine,
  LuRefreshCw,
  LuRotateCcw,
  LuSave,
  LuSearch,
  LuStickyNote,
  LuTrash2,
  LuTruck,
  LuWeight,
  LuX,
} from 'react-icons/lu'
import api from '../api/client'
import { getApiErrorMessage, getFieldErrors } from '../api/errors'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { EmptyState, ErrorState } from '../components/States'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import JalaliDateInput from '../components/JalaliDateInput'
import PeriodBar from '../components/PeriodBar'
import { ProductAvatar } from '../components/BrandLogo'
import {
  formatDecimal,
  formatKg,
  formatNumber,
  parseNumericInput,
  toEnglishDigits,
} from '../utils/format'
import {
  formatJalali,
  formatTime,
  getPeriodRange,
  startOfJalaliMonthISO,
  todayISO,
  daysBetweenISO,
} from '../utils/date'

const PAGE_SIZE = 8
const WORKDAY_PAGE_SIZE = 5

const GARRI_OPTIONS = [
  { value: '1', label: 'گاری ۱' },
  { value: '2', label: 'گاری ۲' },
  { value: '3', label: 'گاری ۳' },
  { value: '4', label: 'گاری ۴' },
  { value: '5', label: 'گاری ۵' },
]

const ROLE_SIXTY = 'مدیر ۶۰ درصد'
const ROLE_NINETY = 'مدیر ۹۰ درصد'
const ROLE_MATERIAL = 'مدیر مواد اولیه'

const TABS = [
  { key: 'records', label: 'سوابق تولید', icon: LuClipboardList },
  { key: 'workdays', label: 'مواد اولیه و گاری', icon: LuTruck },
]

function emptyForm(productId = '', producerId = '') {
  return {
    date: todayISO(),
    producer: producerId ? String(producerId) : '',
    product: productId ? String(productId) : '',
    delivered: '',
    amount: '',
    packages: '',
    waste: '',
    scrap: '',
    note: '',
  }
}

function emptyMaterialForm() {
  return {
    onionInput: '',
    chickenInput: '',
    onionUsed: '',
    chickenUsed: '',
    note: '',
  }
}

function modeOfRole(role) {
  if (role === ROLE_NINETY) return 'ninety'
  if (role === ROLE_MATERIAL) return 'material'
  if (role === ROLE_SIXTY) return 'sixty'
  return 'normal'
}

function gramsOfProduct(name) {
  const match = toEnglishDigits(name).match(/(\d+)\s*گرمی/)
  return match ? Number(match[1]) : null
}

function optionalNumber(value) {
  if (!String(value ?? '').trim()) return 0
  return parseNumericInput(value)
}

function groupRecordsByDate(rows) {
  const groups = []
  rows.forEach((row) => {
    const last = groups[groups.length - 1]
    if (last && last.date === row.date) {
      last.rows.push(row)
      last.amount += Number(row.amount_kg || 0)
      last.packages += Number(row.packages_count || 0)
      return
    }
    groups.push({
      date: row.date,
      rows: [row],
      amount: Number(row.amount_kg || 0),
      packages: Number(row.packages_count || 0),
    })
  })
  return groups.map((group) => ({
    ...group,
    rows: [...group.rows].sort((a, b) => {
      const created = String(a.created_at || '').localeCompare(String(b.created_at || ''))
      return created !== 0 ? created : Number(a.id) - Number(b.id)
    }),
  }))
}

function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  unit = 'kg',
  placeholder,
  integer = false,
  required = false,
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="text-meat-red">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`input pl-14 ${error ? 'input-error' : ''}`}
          aria-invalid={Boolean(error)}
        />
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
          {unit}
        </span>
      </div>
      {error && <p className="mt-1.5 text-[10px] text-red-300">{error}</p>}
    </div>
  )
}

function NoteField({ id, value, onChange, error, placeholder, label = 'یادداشت' }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        <LuStickyNote className="size-3.5 text-white/35" />
        {label}
        <span className="text-[10px] font-normal text-white/25">(اختیاری)</span>
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || 'اگر توضیحی لازم است اینجا بنویسید…'}
        rows={2}
        maxLength={500}
        className={`input min-h-[64px] resize-y leading-6 ${error ? 'input-error' : ''}`}
      />
      {error && <p className="mt-1.5 text-[10px] text-red-300">{error}</p>}
    </div>
  )
}

function TableRowsSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4].map((row) => (
        <div key={row} className="grid grid-cols-6 gap-3 rounded-lg bg-white/[0.02] p-3">
          {[1, 2, 3, 4, 5, 6].map((cell) => (
            <div key={cell} className="skeleton h-4" />
          ))}
        </div>
      ))}
    </div>
  )
}

function DeleteButton({ label, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ||
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/[0.08] text-red-300/80 transition hover:bg-red-500/20 hover:text-red-200'
      }
      aria-label={label}
    >
      <LuTrash2 className="size-3.5" />
    </button>
  )
}

function WorkdayList({
  rows,
  count,
  page,
  totalPages,
  loading,
  error,
  filter,
  user,
  onRetry,
  onPageChange,
  onDeleteDay,
  onDeleteCart,
}) {
  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title="دریافت سوابق روزانه ناموفق بود"
          message={error}
          onRetry={onRetry}
        />
      </div>
    )
  }

  if (loading && !rows.length) {
    return <TableRowsSkeleton />
  }

  if (!rows.length) {
    return (
      <EmptyState
        title={filter ? 'روز کاری‌ای با این گاری پیدا نشد' : 'هنوز سابقه‌ای ثبت نشده'}
        description={
          filter
            ? 'فیلتر گاری را تغییر دهید.'
            : 'با انتخاب تولیدکننده «علی توانا» در فرم بالا، وزن گاری‌ها و مواد اولیه را ثبت کنید.'
        }
        icon={LuTruck}
      />
    )
  }

  return (
    <div>
      <div className="divide-y divide-white/[0.055]">
        {rows.map((day) => {
          const canDeleteDay = Boolean(
            user?.is_staff ||
              day.material?.created_by === user?.id ||
              day.carts.some((cart) => cart.created_by === user?.id),
          )
          const canDeleteCart = (cart) =>
            Boolean(user?.is_staff || cart.created_by === user?.id)
          return (
            <div key={day.date} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-bold text-white">
                    <LuCalendarDays className="size-4 text-meat-red" />
                    روز کاری {formatJalali(day.date, { withWeekday: true })}
                  </p>
                  <p className="mt-1 text-[10px] text-white/35">
                    {day.producer
                      ? `${day.producer.name} — ${day.producer.role}`
                      : 'تولیدکننده ثبت نشده'}
                    {' · '}
                    ثبت‌کننده: {day.created_by_name || '—'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip border-sky-400/20 bg-sky-400/10 text-sky-200">
                    <LuWeight className="size-3" />
                    ورودی: {formatDecimal(day.cart_total_kg)}
                    <span className="text-[9px] text-sky-200/60">kg</span>
                  </span>
                  <span className="chip border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                    <LuWeight className="size-3" />
                    خروجی: {formatDecimal(day.cart_output_total_kg || 0)}
                    <span className="text-[9px] text-emerald-200/60">kg</span>
                  </span>
                  {canDeleteDay && (
                    <DeleteButton
                      label={`حذف روز کاری ${formatJalali(day.date)}`}
                      onClick={() => onDeleteDay(day)}
                    />
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_1fr]">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <p className="text-[10px] font-medium text-white/35">
                    وزن گوشت ورودی / خروجی هر گاری (کیلوگرم)
                  </p>
                  <div className="mt-2.5 grid grid-cols-5 gap-2">
                    {GARRI_OPTIONS.map((option) => {
                      const cart = day.carts.find((row) => row.garri === option.value)
                      return (
                        <div
                          key={option.value}
                          className={`rounded-lg border p-2 text-center ${
                            cart
                              ? 'border-sky-400/25 bg-sky-400/[0.07]'
                              : 'border-white/[0.05] bg-white/[0.015]'
                          }`}
                        >
                          <p className="text-[9px] text-white/35">{option.label}</p>
                          <p
                            className={`mt-1 text-[12px] font-bold ${
                              cart ? 'text-white' : 'text-white/25'
                            }`}
                          >
                            {cart ? formatDecimal(cart.meat_input_kg) : '—'}
                          </p>
                          <p
                            className={`text-[10px] ${
                              cart ? 'text-emerald-200/70' : 'text-white/20'
                            }`}
                          >
                            {cart ? formatDecimal(cart.meat_output_kg || 0) : '—'}
                          </p>
                          <p className="mt-0.5 text-[8px] text-white/20">ورودی / خروجی</p>
                          {cart && canDeleteCart(cart) && (
                            <button
                              type="button"
                              onClick={() => onDeleteCart(cart)}
                              className="mt-1 text-[9px] text-red-300/70 transition hover:text-red-200"
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <p className="text-[10px] font-medium text-white/35">مواد اولیه روز</p>
                  {day.material ? (
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-center">
                      {[
                        ['ورودی پیاز', day.material.onion_input_kg],
                        ['ورودی مرغ', day.material.chicken_input_kg],
                        ['پیاز مصرفی', day.material.onion_used_kg],
                        ['مرغ مصرفی', day.material.chicken_used_kg],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-2"
                        >
                          <p className="text-[9px] text-white/30">{label}</p>
                          <p className="mt-1 text-[12px] font-bold text-white">
                            {formatDecimal(value)}
                            <span className="mr-1 text-[8px] font-normal text-white/25">kg</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-white/25">
                      برای این روز مواد اولیه ثبت نشده است.
                    </p>
                  )}
                </div>
              </div>

              {day.note && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2 text-[11px] leading-6 text-amber-100/75">
                  <LuStickyNote className="mt-0.5 size-3.5 shrink-0 text-amber-300/70" />
                  {day.note}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-white/[0.055]">
        <Pagination
          page={page}
          totalPages={totalPages}
          count={count}
          pageSize={WORKDAY_PAGE_SIZE}
          onPageChange={onPageChange}
          itemLabel="روز کاری"
        />
      </div>
    </div>
  )
}

export default function Production() {
  const { user } = useAuth()
  const toast = useToast()

  const [products, setProducts] = useState([])
  const [producers, setProducers] = useState([])
  const [stats, setStats] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [fatalError, setFatalError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const [form, setForm] = useState(() => emptyForm())
  const [materialForm, setMaterialForm] = useState(() => emptyMaterialForm())
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [records, setRecords] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [producerFilter, setProducerFilter] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const recordsRequest = useRef(0)

  const [tab, setTab] = useState('records')

  const [workdayRows, setWorkdayRows] = useState([])
  const [workdayCount, setWorkdayCount] = useState(0)
  const [workdayPage, setWorkdayPage] = useState(1)
  const [workdayFilter, setWorkdayFilter] = useState('')
  const [workdayLoading, setWorkdayLoading] = useState(true)
  const [workdayError, setWorkdayError] = useState('')

  const [cartGarri, setCartGarri] = useState('1')
  const [cartWeight, setCartWeight] = useState('')
  const [cartOutput, setCartOutput] = useState('')
  const [cartSaving, setCartSaving] = useState(false)
  const [dayCarts, setDayCarts] = useState([])

  const [draftLines, setDraftLines] = useState([])
  const [lineError, setLineError] = useState('')
  const lineSeq = useRef(0)

  const [periodMode, setPeriodMode] = useState('all')
  const [range, setRange] = useState({ start: '', end: '' })
  const [customOpen, setCustomOpen] = useState(false)
  const [draftRange, setDraftRange] = useState({
    start: startOfJalaliMonthISO(),
    end: todayISO(),
  })
  const [filterError, setFilterError] = useState('')

  const [details, setDetails] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const selectedProducer = producers.find(
    (producer) => String(producer.id) === form.producer,
  )
  const producerRole = selectedProducer?.role || ''
  const formMode = modeOfRole(producerRole)

  const productPool = useMemo(() => {
    if (formMode === 'ninety') {
      return products.filter((product) => product.name.includes('۹۰ درصد'))
    }
    if (formMode === 'sixty') {
      return products.filter((product) => product.name.includes('۶۰ درصد'))
    }
    return products
  }, [products, formMode])

  const draftLinesTotal = useMemo(
    () => draftLines.reduce((total, line) => total + line.amount, 0),
    [draftLines],
  )

  const loadStats = useCallback(async () => {
    const { data } = await api.get('/stats/')
    setStats(data)
    return data
  }, [])

  const loadInitial = useCallback(async () => {
    setInitialLoading(true)
    setFatalError('')
    try {
      const [productsResponse, producersResponse, statsData] = await Promise.all([
        api.get('/products/?active=1&page_size=100'),
        api.get('/producers/?active=1&page_size=100'),
        api.get('/stats/'),
      ])
      const activeProducts = productsResponse.data.results ?? productsResponse.data
      const activeProducers = producersResponse.data.results ?? producersResponse.data
      setProducts(activeProducts)
      setProducers(activeProducers)
      setStats(statsData.data)
      const firstNinety = activeProducts.find((product) =>
        product.name.includes('۹۰ درصد'),
      )
      setForm((current) =>
        current.producer || current.product
          ? current
          : emptyForm(
              firstNinety?.id ?? activeProducts[0]?.id ?? '',
              activeProducers[0]?.id ?? '',
            ),
      )
    } catch (requestError) {
      setFatalError(
        getApiErrorMessage(requestError, 'دریافت اطلاعات فرم تولید ناموفق بود.'),
      )
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadRecords = useCallback(async () => {
    const requestId = recordsRequest.current + 1
    recordsRequest.current = requestId
    setRecordsLoading(true)
    setRecordsError('')
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (searchTerm) params.search = searchTerm
      if (producerFilter) params.producer = producerFilter
      if (range.start) params.start_date = range.start
      if (range.end) params.end_date = range.end
      const { data } = await api.get('/records/', { params })
      if (requestId !== recordsRequest.current) return
      setRecords(data.results ?? [])
      setCount(data.count ?? 0)
    } catch (requestError) {
      if (requestId !== recordsRequest.current) return
      setRecords([])
      setCount(0)
      setRecordsError(getApiErrorMessage(requestError, 'دریافت سوابق تولید ناموفق بود.'))
    } finally {
      if (requestId === recordsRequest.current) setRecordsLoading(false)
    }
  }, [page, searchTerm, producerFilter, range.start, range.end, reloadToken])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const loadWorkdays = useCallback(async () => {
    setWorkdayLoading(true)
    setWorkdayError('')
    try {
      const params = { page: workdayPage, page_size: WORKDAY_PAGE_SIZE }
      if (workdayFilter) params.garri = workdayFilter
      if (range.start) params.start_date = range.start
      if (range.end) params.end_date = range.end
      const { data } = await api.get('/workdays/', { params })
      setWorkdayRows(data.results ?? [])
      setWorkdayCount(data.count ?? 0)
    } catch (requestError) {
      setWorkdayRows([])
      setWorkdayCount(0)
      setWorkdayError(
        getApiErrorMessage(requestError, 'دریافت سوابق روزانه ناموفق بود.'),
      )
    } finally {
      setWorkdayLoading(false)
    }
  }, [workdayPage, workdayFilter, range.start, range.end, reloadToken])

  useEffect(() => {
    if (tab === 'workdays') loadWorkdays()
  }, [tab, loadWorkdays])

  const loadDayCarts = useCallback(async () => {
    if (!form.producer || !form.date) {
      setDayCarts([])
      return
    }
    try {
      const { data } = await api.get('/workdays/', {
        params: {
          producer: form.producer,
          date: form.date,
          page_size: 10,
        },
      })
      const day = data.results?.[0]
      setDayCarts(day?.carts ?? [])
    } catch {
      setDayCarts([])
    }
  }, [form.producer, form.date])

  useEffect(() => {
    if (formMode === 'material') loadDayCarts()
  }, [formMode, loadDayCarts])

  const selectCart = (value) => {
    setCartGarri(value)
    const existing = dayCarts.find((cart) => cart.garri === value)
    setCartWeight(existing ? String(existing.meat_input_kg) : '')
    setCartOutput(existing ? String(existing.meat_output_kg ?? '') : '')
    setFieldErrors((current) => {
      if (!current.cartWeight && !current.cartOutput) return current
      const next = { ...current }
      delete next.cartWeight
      delete next.cartOutput
      return next
    })
  }

  const selectPeriod = (key) => {
    setCustomOpen(false)
    setFilterError('')
    setPage(1)
    setWorkdayPage(1)
    if (key === 'all') {
      setPeriodMode('all')
      setRange({ start: '', end: '' })
      return
    }
    setPeriodMode(key)
    setRange(getPeriodRange(key))
  }

  const openCustomRange = () => {
    setDraftRange((current) => ({
      start: current.start || range.start,
      end: current.end || range.end,
    }))
    setCustomOpen(true)
    setFilterError('')
  }

  const changeDraftRange = (field, value) => {
    setDraftRange((current) => ({ ...current, [field]: value }))
    setFilterError('')
  }

  const applyCustomRange = () => {
    if (!draftRange.start || !draftRange.end) {
      setFilterError('تاریخ شروع و پایان را وارد کنید.')
      return
    }
    if (draftRange.start > draftRange.end) {
      setFilterError('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.')
      return
    }
    if (draftRange.end > todayISO()) {
      setFilterError('تاریخ پایان نمی‌تواند در آینده باشد.')
      return
    }
    if (daysBetweenISO(draftRange.start, draftRange.end) > 366) {
      setFilterError('بازه انتخابی نمی‌تواند بیشتر از یک سال باشد.')
      return
    }
    setPeriodMode('custom')
    setRange({ start: draftRange.start, end: draftRange.end })
    setCustomOpen(false)
    setFilterError('')
    setPage(1)
    setWorkdayPage(1)
  }

  const addDraftLine = () => {
    const product = productPool.find(
      (item) => String(item.id) === String(form.product),
    )
    const packages = parseNumericInput(form.packages)
    if (!product) {
      setLineError('محصول را انتخاب کنید.')
      return
    }
    if (packages === null || packages <= 0 || !Number.isInteger(packages)) {
      setLineError('تعداد بسته باید عدد صحیح و بزرگ‌تر از صفر باشد.')
      return
    }
    const grams = gramsOfProduct(product.name) || 0
    lineSeq.current += 1
    setDraftLines((current) => [
      ...current,
      {
        key: `line-${lineSeq.current}`,
        productId: product.id,
        productName: product.name,
        productImage: product.image_url,
        packages,
        grams,
        amount: (packages * grams) / 1000,
      },
    ])
    setLineError('')
    setForm((current) => ({ ...current, packages: '', product: '' }))
  }

  const removeDraftLine = (key) => {
    setDraftLines((current) => current.filter((line) => line.key !== key))
  }


  const workdayTotalPages = Math.max(1, Math.ceil(workdayCount / WORKDAY_PAGE_SIZE))
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const activeCount = tab === 'workdays' ? workdayCount : count
  const activePage = tab === 'workdays' ? workdayPage : page
  const activeTotalPages = tab === 'workdays' ? workdayTotalPages : totalPages

  const changeField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const changeMaterialField = (name, value) => {
    setMaterialForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const selectProducer = (value) => {
    const producer = producers.find((item) => String(item.id) === String(value))
    const mode = modeOfRole(producer?.role)
    const pool =
      mode === 'ninety'
        ? products.filter((product) => product.name.includes('۹۰ درصد'))
        : mode === 'sixty'
          ? products.filter((product) => product.name.includes('۶۰ درصد'))
          : products
    setForm((current) => {
      const keepProduct = pool.some(
        (product) => String(product.id) === String(current.product),
      )
      return {
        ...current,
        producer: String(value),
        product: keepProduct ? current.product : pool[0] ? String(pool[0].id) : '',
      }
    })
    setFieldErrors((current) => {
      if (!current.producer && !current.product) return current
      const next = { ...current }
      delete next.producer
      delete next.product
      return next
    })
  }

  useEffect(() => {
    setForm((current) => {
      if (!current.product) return current
      const stillValid = productPool.some(
        (product) => String(product.id) === String(current.product),
      )
      return stillValid
        ? current
        : { ...current, product: productPool[0] ? String(productPool[0].id) : '' }
    })
  }, [productPool])

  const validateProduction = () => {
    const errors = {}
    if (!form.date) {
      errors.date = 'تاریخ را وارد کنید.'
    } else if (form.date > todayISO()) {
      errors.date = 'ثبت برای تاریخ آینده مجاز نیست.'
    }
    if (!form.producer) errors.producer = 'تولیدکننده را انتخاب کنید.'
    if (!form.product) errors.product = 'محصول را انتخاب کنید.'

    const packages = parseNumericInput(form.packages)
    if (packages === null || packages < 0 || !Number.isInteger(packages)) {
      errors.packages = 'تعداد بسته باید عدد صحیح و نامنفی باشد.'
    }

    const waste = optionalNumber(form.waste)
    if (waste === null || waste < 0) {
      errors.waste = 'وزن معدومی‌ها باید عدد نامنفی باشد.'
    }

    const scrap = optionalNumber(form.scrap)
    if (scrap === null || scrap < 0) {
      errors.scrap = 'وزن ضایعات باید عدد نامنفی باشد.'
    }

    const delivered = parseNumericInput(form.delivered)
    if (delivered === null || delivered <= 0) {
      errors.delivered = 'وزن گوشت تحویل داده شده باید بیشتر از صفر باشد.'
    }

    const amount = parseNumericInput(form.amount)
    if (amount === null || amount <= 0) {
      errors.amount = 'وزن گوشت تولید شده باید بیشتر از صفر باشد.'
    }

    return { errors, delivered, amount, packages, waste, scrap }
  }

  const validateMaterial = () => {
    const errors = {}
    if (!form.date) {
      errors.date = 'تاریخ را وارد کنید.'
    } else if (form.date > todayISO()) {
      errors.date = 'ثبت برای تاریخ آینده مجاز نیست.'
    }
    if (!form.producer) errors.producer = 'تولیدکننده را انتخاب کنید.'

    const onionInput = parseNumericInput(materialForm.onionInput)
    if (onionInput === null || onionInput < 0) {
      errors.onionInput = 'ورودی پیاز باید عدد نامنفی باشد.'
    }

    const chickenInput = parseNumericInput(materialForm.chickenInput)
    if (chickenInput === null || chickenInput < 0) {
      errors.chickenInput = 'ورودی مرغ باید عدد نامنفی باشد.'
    }

    const onionUsed = parseNumericInput(materialForm.onionUsed)
    if (onionUsed === null || onionUsed < 0) {
      errors.onionUsed = 'پیاز مصرفی باید عدد نامنفی باشد.'
    }

    const chickenUsed = parseNumericInput(materialForm.chickenUsed)
    if (chickenUsed === null || chickenUsed < 0) {
      errors.chickenUsed = 'مرغ مصرفی باید عدد نامنفی باشد.'
    }

    return { errors, onionInput, chickenInput, onionUsed, chickenUsed }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (formMode === 'material') {
      const values = validateMaterial()
      setFieldErrors(values.errors)
      if (Object.keys(values.errors).length) return

      setSubmitting(true)
      try {
        await api.post('/materials/', {
          date: form.date,
          producer: Number(form.producer),
          onion_input_kg: String(values.onionInput),
          chicken_input_kg: String(values.chickenInput),
          onion_used_kg: String(values.onionUsed),
          chicken_used_kg: String(values.chickenUsed),
          note: materialForm.note.trim(),
        })
        toast.success('اطلاعات مواد اولیه با موفقیت ثبت شد.')
        setMaterialForm(emptyMaterialForm())
        setFieldErrors({})
        setWorkdayPage(1)
        setReloadToken((current) => current + 1)
        await loadDayCarts().catch(() => {})
        await loadStats().catch(() => {})
      } catch (requestError) {
        setFieldErrors(getFieldErrors(requestError))
        toast.error(getApiErrorMessage(requestError, 'ثبت مواد اولیه ناموفق بود.'))
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (formMode === 'ninety') {
      if (!form.date) {
        setFieldErrors({ date: 'تاریخ را وارد کنید.' })
        return
      }
      if (form.date > todayISO()) {
        setFieldErrors({ date: 'ثبت برای تاریخ آینده مجاز نیست.' })
        return
      }
      if (!form.producer) {
        setFieldErrors({ producer: 'تولیدکننده را انتخاب کنید.' })
        return
      }
      if (!draftLines.length) {
        setLineError('حداقل یک محصول را با دکمهٔ تیک «افزودن محصول» اضافه کنید.')
        return
      }
      const waste = optionalNumber(form.waste)
      const scrap = optionalNumber(form.scrap)
      if (waste === null || waste < 0) {
        setFieldErrors({ waste: 'وزن معدومی‌ها باید عدد نامنفی باشد.' })
        return
      }
      if (scrap === null || scrap < 0) {
        setFieldErrors({ scrap: 'وزن ضایعات باید عدد نامنفی باشد.' })
        return
      }

      setSubmitting(true)
      try {
        const { data } = await api.post('/records/bulk/', {
          date: form.date,
          producer: Number(form.producer),
          items: draftLines.map((line) => ({
            product: line.productId,
            packages_count: line.packages,
          })),
          waste_kg: String(waste),
          scrap_kg: String(scrap),
          note: form.note.trim(),
        })
        toast.success(
          `${formatNumber(data.length)} محصول برای ${formatJalali(form.date)} ثبت شد.`,
        )
        setDraftLines([])
        setLineError('')
        setFieldErrors({})
        setForm((current) => ({
          ...current,
          packages: '',
          waste: '',
          scrap: '',
          note: '',
        }))
        setPage(1)
        setWorkdayPage(1)
        setReloadToken((current) => current + 1)
        await loadStats().catch(() => {})
      } catch (requestError) {
        setFieldErrors(getFieldErrors(requestError))
        toast.error(getApiErrorMessage(requestError, 'ثبت اطلاعات ناموفق بود.'))
      } finally {
        setSubmitting(false)
      }
      return
    }

    const values = validateProduction()
    setFieldErrors(values.errors)
    if (Object.keys(values.errors).length) return

    setSubmitting(true)
    try {
      const payload = {
        date: form.date,
        producer: Number(form.producer),
        product: Number(form.product),
        packages_count: values.packages,
        waste_kg: String(values.waste),
        scrap_kg: String(values.scrap),
        note: form.note.trim(),
        delivered_meat_kg: String(values.delivered),
        amount_kg: String(values.amount),
      }

      const { data } = await api.post('/records/', payload)
      toast.success(`سابقه تولید «${data.product_name}» با موفقیت ثبت شد.`)
      setForm((current) => ({
        ...current,
        delivered: '',
        amount: '',
        packages: '',
        waste: '',
        scrap: '',
        note: '',
      }))
      setFieldErrors({})
      setPage(1)
      setReloadToken((current) => current + 1)
      await loadStats().catch(() => {})
    } catch (requestError) {
      setFieldErrors(getFieldErrors(requestError))
      toast.error(getApiErrorMessage(requestError, 'ثبت اطلاعات ناموفق بود.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveCart = async () => {
    if (!form.producer) {
      toast.error('ابتدا تولیدکننده را انتخاب کنید.')
      return
    }
    const weight = parseNumericInput(cartWeight)
    if (weight === null || weight <= 0) {
      setFieldErrors((current) => ({
        ...current,
        cartWeight: 'وزن گوشت ورودی گاری باید بیشتر از صفر باشد.',
      }))
      return
    }
    const output = parseNumericInput(cartOutput)
    if (output === null || output < 0) {
      setFieldErrors((current) => ({
        ...current,
        cartOutput: 'وزن گوشت خروجی گاری باید عدد نامنفی باشد.',
      }))
      return
    }
    const label = GARRI_OPTIONS.find((option) => option.value === cartGarri)?.label
    setCartSaving(true)
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.cartWeight
      delete next.cartOutput
      return next
    })
    try {
      const { data } = await api.post('/garri/', {
        date: form.date,
        producer: Number(form.producer),
        garri: cartGarri,
        meat_input_kg: String(weight),
        meat_output_kg: String(output),
      })
      toast.success(
        data.is_update
          ? `${label} برای این تاریخ به‌روزرسانی شد.`
          : `${label} ثبت شد — ورودی ${formatDecimal(weight)} و خروجی ${formatDecimal(output)} کیلوگرم.`,
      )
      setCartWeight('')
      setCartOutput('')
      setReloadToken((current) => current + 1)
      await loadDayCarts().catch(() => {})
    } catch (requestError) {
      const apiFieldErrors = getFieldErrors(requestError)
      setFieldErrors((current) => ({ ...current, ...apiFieldErrors }))
      toast.error(getApiErrorMessage(requestError, 'ثبت وزن گاری ناموفق بود.'))
    } finally {
      setCartSaving(false)
    }
  }

  const handleReset = () => {
    const defaultProduct = productPool[0]?.id ?? products[0]?.id ?? ''
    const defaultProducer = producers[0]?.id ?? ''
    setForm(emptyForm(defaultProduct, defaultProducer))
    setMaterialForm(emptyMaterialForm())
    setCartWeight('')
    setCartOutput('')
    setDraftLines([])
    setLineError('')
    setFieldErrors({})
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setReloadToken((current) => current + 1)
    try {
      await loadStats()
      if (tab === 'workdays') await loadWorkdays()
      toast.success('اطلاعات تولید به‌روزرسانی شد.')
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'به‌روزرسانی آمار ناموفق بود.'))
    } finally {
      setRefreshing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { kind, item } = deleteTarget
    setDeleting(true)
    try {
      if (kind === 'cart') {
        await api.delete(`/garri/${item.id}/`)
        toast.success('وزن گاری حذف شد.')
        await loadDayCarts().catch(() => {})
        setReloadToken((current) => current + 1)
      } else if (kind === 'workday') {
        if (item.material) await api.delete(`/materials/${item.material.id}/`)
        await Promise.all(item.carts.map((cart) => api.delete(`/garri/${cart.id}/`)))
        toast.success('روز کاری حذف شد.')
        if (workdayRows.length === 1 && workdayPage > 1) {
          setWorkdayPage((current) => current - 1)
        } else {
          setReloadToken((current) => current + 1)
        }
      } else {
        await api.delete(`/records/${item.id}/`)
        toast.success('سابقه تولید حذف شد.')
        if (records.length === 1 && page > 1) {
          setPage((current) => current - 1)
        } else {
          setReloadToken((current) => current + 1)
        }
      }
      setDeleteTarget(null)
      await loadStats().catch(() => {})
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'حذف سابقه ناموفق بود.'))
    } finally {
      setDeleting(false)
    }
  }

  const statCards = useMemo(() => {
    if (!stats) return []
    return [
      {
        title: 'گوشت تحویل داده شده',
        value: formatDecimal(stats.totals.delivered_meat_kg),
        unit: 'کیلوگرم امروز',
        change: stats.changes.delivered_meat_kg,
        icon: LuTruck,
        tone: 'green',
      },
      {
        title: 'گوشت تولید شده',
        value: formatDecimal(stats.totals.amount_kg),
        unit: 'کیلوگرم امروز',
        change: stats.changes.amount_kg,
        icon: LuBeef,
        tone: 'blue',
      },
      {
        title: 'تعداد بسته',
        value: formatNumber(stats.totals.packages_count),
        unit: 'بسته‌بندی امروز',
        change: stats.changes.packages_count,
        icon: LuPackage,
        tone: 'orange',
      },
      {
        title: 'وزن معدومی‌ها',
        value: formatDecimal(stats.totals.waste_kg),
        unit: 'کیلوگرم امروز',
        change: stats.changes.waste_kg,
        icon: LuTrash2,
        tone: 'purple',
        invertTrend: true,
      },
    ]
  }, [stats])

  const groupedRecords = useMemo(() => groupRecordsByDate(records), [records])

  const deleteDescription = (() => {
    if (!deleteTarget) return ''
    const { kind, item } = deleteTarget
    if (kind === 'cart') {
      return `آیا از حذف وزن ${item.garri_display} در تاریخ ${formatJalali(item.date)} مطمئن هستید؟ این عملیات قابل بازگشت نیست.`
    }
    if (kind === 'workday') {
      return `آیا از حذف کل اطلاعات روز کاری ${formatJalali(item.date)} (گاری‌ها و مواد اولیه) مطمئن هستید؟ این عملیات قابل بازگشت نیست.`
    }
    return `آیا از حذف سابقه «${item.producer_name} — ${item.product_name}» با تولید ${formatKg(item.amount_kg)} مطمئن هستید؟ این عملیات قابل بازگشت نیست.`
  })()

  const formTitle =
    formMode === 'material'
      ? 'ثبت مواد اولیه و وزن گاری‌ها'
      : formMode === 'ninety'
        ? 'ثبت آمار تولید — مدیر ۹۰ درصد'
        : formMode === 'sixty'
          ? 'ثبت آمار تولید — مدیر ۶۰ درصد'
          : 'ثبت اطلاعات تولید'

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="عملیات روزانه"
        title="ثبت آمار تولید"
        description="ثبت و مدیریت اطلاعات تولید روزانه کارخانه، مواد اولیه و وزن گاری‌ها."
        icon={LuPencilLine}
        actions={
          <>
            <Link to="/dashboard" className="btn-secondary">
              مشاهده داشبورد
            </Link>
            <button
              type="button"
              onClick={handleRefresh}
              className="btn-secondary"
              disabled={refreshing || initialLoading}
            >
              <LuRefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              به‌روزرسانی
            </button>
          </>
        }
      />

      {initialLoading ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <StatCard key={item} loading />
            ))}
          </div>
          <div className="panel mt-4 h-[246px] p-6">
            <div className="skeleton h-4 w-40" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="skeleton h-11" />
              ))}
            </div>
          </div>
        </>
      ) : fatalError ? (
        <ErrorState message={fatalError} onRetry={loadInitial} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {statCards.map((card, index) => (
              <StatCard
                key={card.title}
                {...card}
                comparisonLabel="نسبت به دیروز"
                delayClass={`stagger-${index + 1}`}
              />
            ))}
          </div>

          <section className="panel mt-4 overflow-hidden">
            <div className="h-[3px] w-full bg-gradient-to-l from-meat-red via-red-500/70 to-transparent" />
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <LuPencilLine className="size-[18px] text-meat-red" />
                  {formTitle}
                </h2>
                <p className="panel-subtitle">
                  {formMode === 'material'
                    ? 'وزن هر گاری را جداگانه ثبت کنید و مواد اولیه روز را وارد کنید.'
                    : formMode === 'ninety'
                      ? 'تعداد بسته و محصول را انتخاب کنید و با تیک به لیست روز کاری اضافه کنید.'
                      : 'اطلاعات تولید را دقیق وارد کنید؛ تاریخ به تقویم شمسی ثبت می‌شود.'}
                </p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[10px] text-white/35 sm:flex">
                ثبت‌کننده:
                <span className="text-white/65">{user?.display_name || user?.username}</span>
              </span>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6" noValidate>
              <div className="rounded-xl border border-meat-red/20 bg-meat-red/[0.045] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="production-producer" className="field-label">
                      تولیدکننده <span className="text-meat-red">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="production-producer"
                        value={form.producer}
                        onChange={(event) => selectProducer(event.target.value)}
                        className={`select ${fieldErrors.producer ? 'input-error' : ''}`}
                        disabled={!producers.length}
                      >
                        <option value="">انتخاب تولیدکننده</option>
                        {producers.map((producer) => (
                          <option key={producer.id} value={producer.id}>
                            {producer.name} — {producer.role}
                          </option>
                        ))}
                      </select>
                      <LuChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                    </div>
                    {fieldErrors.producer && (
                      <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.producer}</p>
                    )}
                    {!producers.length && !fieldErrors.producer && (
                      <p className="mt-1.5 text-[10px] text-amber-300">
                        تولیدکننده فعالی وجود ندارد؛ از{' '}
                        <Link to="/producers" className="underline underline-offset-2">
                          مدیریت تولیدکنندگان
                        </Link>{' '}
                        اضافه کنید.
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-[10px] text-white/40 sm:mb-0.5 sm:min-w-[210px]">
                    <span className="text-white/25">سمت انتخاب‌شده: </span>
                    <span className="font-medium text-white/70">{producerRole || '—'}</span>
                  </div>
                </div>
              </div>

              {formMode === 'material' && (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="material-date" className="field-label">
                        تاریخ <span className="text-meat-red">*</span>
                      </label>
                      <JalaliDateInput
                        id="material-date"
                        value={form.date}
                        onChange={(value) => changeField('date', value)}
                        error={fieldErrors.date}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <p className="field-label">گاری‌های ثبت‌شده این روز</p>
                      <div className="grid grid-cols-5 gap-2">
                        {GARRI_OPTIONS.map((option) => {
                          const saved = dayCarts.find((cart) => cart.garri === option.value)
                          return (
                            <div
                              key={option.value}
                              className={`rounded-lg border px-2 py-2 text-center ${
                                saved
                                  ? 'border-emerald-400/25 bg-emerald-400/[0.07]'
                                  : 'border-white/[0.06] bg-white/[0.02]'
                              }`}
                            >
                              <p className="text-[9px] text-white/35">{option.label}</p>
                              <p
                                className={`mt-1 text-[11px] font-bold ${
                                  saved ? 'text-emerald-200' : 'text-white/25'
                                }`}
                              >
                                {saved ? formatDecimal(saved.meat_input_kg) : '—'}
                              </p>
                              <p
                                className={`text-[9px] ${
                                  saved ? 'text-sky-200/70' : 'text-white/20'
                                }`}
                              >
                                {saved ? formatDecimal(saved.meat_output_kg || 0) : '—'}
                              </p>
                              <p className="text-[8px] text-white/20">ورودی / خروجی</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/[0.045] p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[150px] flex-1">
                        <label htmlFor="cart-select" className="field-label">
                          انتخاب گاری <span className="text-meat-red">*</span>
                        </label>
                        <div className="relative">
                          <select
                            id="cart-select"
                            value={cartGarri}
                            onChange={(event) => selectCart(event.target.value)}
                            className="select"
                          >
                            {GARRI_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <LuChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                        </div>
                      </div>
                      <div className="min-w-[170px] flex-1">
                        <label htmlFor="cart-weight" className="field-label">
                          وزن گوشت ورودی گاری (کیلوگرم)
                          <span className="text-meat-red">*</span>
                        </label>
                        <div className="relative">
                          <input
                            id="cart-weight"
                            type="text"
                            inputMode="decimal"
                            value={cartWeight}
                            onChange={(event) => {
                              setCartWeight(event.target.value)
                              setFieldErrors((current) => {
                                if (!current.cartWeight) return current
                                const next = { ...current }
                                delete next.cartWeight
                                return next
                              })
                            }}
                            placeholder="مثلاً ۳۰۰"
                            className={`input pl-14 ${fieldErrors.cartWeight ? 'input-error' : ''}`}
                          />
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                            kg
                          </span>
                        </div>
                        {fieldErrors.cartWeight && (
                          <p className="mt-1.5 text-[10px] text-red-300">
                            {fieldErrors.cartWeight}
                          </p>
                        )}
                      </div>
                      <div className="min-w-[170px] flex-1">
                        <label htmlFor="cart-output" className="field-label">
                          وزن گوشت خروجی گاری (کیلوگرم)
                          <span className="text-meat-red">*</span>
                        </label>
                        <div className="relative">
                          <input
                            id="cart-output"
                            type="text"
                            inputMode="decimal"
                            value={cartOutput}
                            onChange={(event) => {
                              setCartOutput(event.target.value)
                              setFieldErrors((current) => {
                                if (!current.cartOutput) return current
                                const next = { ...current }
                                delete next.cartOutput
                                return next
                              })
                            }}
                            placeholder="مثلاً ۲۸۰"
                            className={`input pl-14 ${fieldErrors.cartOutput ? 'input-error' : ''}`}
                          />
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                            kg
                          </span>
                        </div>
                        {fieldErrors.cartOutput && (
                          <p className="mt-1.5 text-[10px] text-red-300">
                            {fieldErrors.cartOutput}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveCart}
                        disabled={cartSaving}
                        className="btn-primary min-w-[150px]"
                      >
                        {cartSaving ? (
                          <LuLoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <LuSave className="size-4" />
                        )}
                        ثبت وزن گاری
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-sky-200/45">
                      هر گاری جداگانه ثبت می‌شود؛ ثبت دوباره همان گاری، وزن آن را به‌روزرسانی
                      می‌کند.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2 xl:grid-cols-4">
                    <NumberField
                      id="material-onion-input"
                      label="ورودی پیاز (کیلوگرم)"
                      value={materialForm.onionInput}
                      onChange={(value) => changeMaterialField('onionInput', value)}
                      error={fieldErrors.onionInput}
                      placeholder="مثلاً ۱۲۰"
                    />
                    <NumberField
                      id="material-chicken-input"
                      label="ورودی مرغ (کیلوگرم)"
                      value={materialForm.chickenInput}
                      onChange={(value) => changeMaterialField('chickenInput', value)}
                      error={fieldErrors.chickenInput}
                      placeholder="مثلاً ۸۰"
                    />
                    <NumberField
                      id="material-onion-used"
                      label="پیاز مصرفی (کیلوگرم)"
                      value={materialForm.onionUsed}
                      onChange={(value) => changeMaterialField('onionUsed', value)}
                      error={fieldErrors.onionUsed}
                      placeholder="مثلاً ۱۰۰"
                    />
                    <NumberField
                      id="material-chicken-used"
                      label="مرغ مصرفی (کیلوگرم)"
                      value={materialForm.chickenUsed}
                      onChange={(value) => changeMaterialField('chickenUsed', value)}
                      error={fieldErrors.chickenUsed}
                      placeholder="مثلاً ۷۵"
                    />
                  </div>

                  <div className="mt-4 border-t border-white/[0.06] pt-4">
                    <NoteField
                      id="material-note"
                      value={materialForm.note}
                      onChange={(value) => changeMaterialField('note', value)}
                      placeholder="توضیح مواد اولیه یا گاری‌های این روز…"
                    />
                  </div>
                </>
              )}

              {formMode !== 'material' && (
                <>
                  {formMode === 'ninety' ? (
                    <>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr_auto] xl:items-end">
                        <div>
                          <label htmlFor="production-date" className="field-label">
                            تاریخ تولید <span className="text-meat-red">*</span>
                          </label>
                          <JalaliDateInput
                            id="production-date"
                            value={form.date}
                            onChange={(value) => changeField('date', value)}
                            error={fieldErrors.date}
                          />
                        </div>
                        <NumberField
                          id="production-packages"
                          label="تعداد بسته تولید شده"
                          value={form.packages}
                          onChange={(value) => changeField('packages', value)}
                          error={fieldErrors.packages}
                          unit="بسته"
                          integer
                          required
                          placeholder="مثلاً ۲۰۰"
                        />
                        <div>
                          <label htmlFor="production-product" className="field-label">
                            محصول تولید شده <span className="text-meat-red">*</span>
                          </label>
                          <div className="relative">
                            <select
                              id="production-product"
                              value={form.product}
                              onChange={(event) => changeField('product', event.target.value)}
                              className={`select ${fieldErrors.product ? 'input-error' : ''}`}
                              disabled={!productPool.length}
                            >
                              <option value="">انتخاب محصول</option>
                              {productPool.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name}
                                </option>
                              ))}
                            </select>
                            <LuChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                          </div>
                          {fieldErrors.product && (
                            <p className="mt-1.5 text-[10px] text-red-300">
                              {fieldErrors.product}
                            </p>
                          )}
                          {!productPool.length && !fieldErrors.product && (
                            <p className="mt-1.5 text-[10px] text-amber-300">
                              محصول ۹۰ درصد فعالی وجود ندارد.
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={addDraftLine}
                          className="btn-secondary min-w-[150px] whitespace-nowrap"
                        >
                          <LuCheck className="size-4" />
                          افزودن محصول
                        </button>
                      </div>

                      {lineError && (
                        <p className="mt-2 text-[10px] text-red-300">{lineError}</p>
                      )}

                      <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
                          <p className="flex items-center gap-2 text-[11px] font-medium text-white/65">
                            <LuPackage className="size-3.5 text-white/35" />
                            محصولات این روز کاری
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/35">
                            <span className="flex items-center gap-1.5">
                              <LuCalendarDays className="size-3.5 text-white/25" />
                              {formatJalali(form.date, { withWeekday: true })}
                            </span>
                            {draftLines.length > 0 && (
                              <span>
                                · {formatNumber(draftLines.length)} محصول ·{' '}
                                {formatDecimal(draftLinesTotal)} کیلوگرم
                              </span>
                            )}
                          </div>
                        </div>
                        {draftLines.length ? (
                          <ul className="divide-y divide-white/[0.05]">
                            {draftLines.map((line) => (
                              <li
                                key={line.key}
                                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <ProductAvatar
                                    name={line.productName}
                                    image={line.productImage}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-[12px] text-white/80">
                                      {line.productName}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-white/35">
                                      {formatJalali(form.date)} ·{' '}
                                      {formatNumber(line.packages)} بسته
                                      {line.amount > 0
                                        ? ` · ${formatDecimal(line.amount)} کیلوگرم`
                                        : ''}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeDraftLine(line.key)}
                                  aria-label={`حذف ${line.productName}`}
                                  className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/[0.08] p-1.5 text-red-300/80 transition hover:bg-red-500/20 hover:text-red-200"
                                >
                                  <LuX className="size-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="px-3.5 py-5 text-center text-[11px] leading-6 text-white/25">
                            هنوز محصولی اضافه نشده است؛ تعداد بسته و محصول را انتخاب کنید و
                            دکمهٔ «افزودن محصول» را بزنید. هر محصول با تیک خودش به این لیست
                            اضافه می‌شود.
                          </p>
                        )}
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <NumberField
                          id="production-waste"
                          label="وزن معدومی‌ها (کیلوگرم)"
                          value={form.waste}
                          onChange={(value) => changeField('waste', value)}
                          error={fieldErrors.waste}
                          placeholder="مثلاً ۶"
                        />
                        <NumberField
                          id="production-scrap"
                          label="وزن ضایعات (کیلوگرم)"
                          value={form.scrap}
                          onChange={(value) => changeField('scrap', value)}
                          error={fieldErrors.scrap}
                          placeholder="مثلاً ۱٫۵"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      <NumberField
                        id="production-delivered"
                        label="وزن گوشت تحویل داده شده (کیلوگرم)"
                        value={form.delivered}
                        onChange={(value) => changeField('delivered', value)}
                        error={fieldErrors.delivered}
                        required
                        placeholder="مثلاً ۱۵۰۰"
                      />
                      <NumberField
                        id="production-amount"
                        label="وزن گوشت تولید شده (کیلوگرم)"
                        value={form.amount}
                        onChange={(value) => changeField('amount', value)}
                        error={fieldErrors.amount}
                        required
                        placeholder="مثلاً ۱۲۵۰"
                      />
                      <NumberField
                        id="production-packages"
                        label="تعداد بسته‌های تولید شده"
                        value={form.packages}
                        onChange={(value) => changeField('packages', value)}
                        error={fieldErrors.packages}
                        unit="بسته"
                        integer
                        placeholder="مثلاً ۸٬۷۵۰"
                      />
                      <NumberField
                        id="production-waste"
                        label="وزن معدومی‌ها (کیلوگرم)"
                        value={form.waste}
                        onChange={(value) => changeField('waste', value)}
                        error={fieldErrors.waste}
                        placeholder="مثلاً ۱۰۰"
                      />
                      <NumberField
                        id="production-scrap"
                        label="وزن ضایعات (کیلوگرم)"
                        value={form.scrap}
                        onChange={(value) => changeField('scrap', value)}
                        error={fieldErrors.scrap}
                        placeholder="مثلاً ۲۰"
                      />
                    </div>
                  )}

                  {formMode !== 'ninety' && (
                    <div className="mt-4 grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="production-date" className="field-label">
                          تاریخ تولید <span className="text-meat-red">*</span>
                        </label>
                        <JalaliDateInput
                          id="production-date"
                          value={form.date}
                          onChange={(value) => changeField('date', value)}
                          error={fieldErrors.date}
                        />
                      </div>

                      <div>
                        <label htmlFor="production-product" className="field-label">
                          محصول <span className="text-meat-red">*</span>
                        </label>
                        <div className="relative">
                          <select
                            id="production-product"
                            value={form.product}
                            onChange={(event) => changeField('product', event.target.value)}
                            className={`select ${fieldErrors.product ? 'input-error' : ''}`}
                            disabled={!productPool.length}
                          >
                            <option value="">انتخاب محصول</option>
                            {productPool.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                          <LuChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                        </div>
                        {fieldErrors.product && (
                          <p className="mt-1.5 text-[10px] text-red-300">
                            {fieldErrors.product}
                          </p>
                        )}
                        {!productPool.length && !fieldErrors.product && (
                          <p className="mt-1.5 text-[10px] text-amber-300">
                            محصول فعالی وجود ندارد؛ از{' '}
                            <Link to="/products" className="underline underline-offset-2">
                              مدیریت محصولات
                            </Link>{' '}
                            اضافه کنید.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 border-t border-white/[0.06] pt-4">
                    <NoteField
                      id="production-note"
                      value={form.note}
                      onChange={(value) => changeField('note', value)}
                      error={fieldErrors.note}
                      placeholder="یادداشت این روز کاری…"
                    />
                  </div>
                </>
              )}

              <div className="mt-6 flex flex-col justify-between gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={submitting} className="btn-primary min-w-[148px]">
                    {submitting ? (
                      <LuLoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <LuCheck className="size-4" />
                    )}
                    {submitting
                      ? 'در حال ثبت…'
                      : formMode === 'material'
                        ? 'ثبت مواد اولیه'
                        : 'ثبت اطلاعات'}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={submitting}
                    className="btn-secondary"
                  >
                    <LuRotateCcw className="size-4" />
                    پاک کردن
                  </button>
                </div>
                <p className="text-[10px] leading-5 text-white/30">
                  تاریخ‌ها بر اساس تقویم شمسی ثبت و نمایش داده می‌شوند.
                </p>
              </div>
            </form>
          </section>

          <section className="panel mt-4 min-w-0 overflow-hidden">
            <div className="flex flex-wrap gap-1.5 border-b border-white/[0.055] px-4 pt-4">
              {TABS.map((item) => {
                const Icon = item.icon
                const active = tab === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-[12px] font-medium transition ${
                      active
                        ? 'border-meat-red text-white'
                        : 'border-transparent text-white/45 hover:text-white/80'
                    }`}
                  >
                    <Icon className={`size-4 ${active ? 'text-meat-red' : 'text-white/35'}`} />
                    {item.label}
                  </button>
                )
              })}
            </div>

            <PeriodBar
              mode={periodMode}
              range={range}
              customOpen={customOpen}
              draft={draftRange}
              error={filterError}
              onSelectPreset={selectPeriod}
              onOpenCustom={openCustomRange}
              onDraftChange={changeDraftRange}
              onApplyCustom={applyCustomRange}
              disabled={initialLoading}
            />

            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  {tab === 'workdays' ? (
                    <LuTruck className="size-[18px] text-meat-red" />
                  ) : (
                    <LuClipboardList className="size-[18px] text-meat-red" />
                  )}
                  {tab === 'workdays' ? 'سوابق روزانه مواد اولیه و گاری' : 'سوابق ثبت تولید'}
                </h2>
                <p className="panel-subtitle">
                  {tab === 'workdays'
                    ? 'اطلاعات هر روز کاری در یک کارت یکجا نمایش داده می‌شود.'
                    : `${formatNumber(activeCount)} سابقه مطابق فیلترهای فعلی`}
                </p>
              </div>
              <span className="hidden rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[10px] text-white/35 sm:inline-flex">
                صفحه {formatNumber(activePage)} از {formatNumber(activeTotalPages)}
              </span>
            </div>

            <div className="flex flex-col gap-3 border-b border-white/[0.055] px-5 py-3.5 sm:flex-row sm:items-center">
              {tab === 'records' && (
                <>
                  <div className="relative flex-1 sm:max-w-xs">
                    <LuSearch className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="جستجو در محصول، تولیدکننده یا ثبت‌کننده…"
                      className="input py-2 pr-9 text-[12px]"
                      aria-label="جستجو در سوابق تولید"
                    />
                  </div>
                  <div className="relative sm:w-48">
                    <select
                      value={producerFilter}
                      onChange={(event) => {
                        setProducerFilter(event.target.value)
                        setPage(1)
                      }}
                      className="select py-2 text-[12px]"
                      aria-label="فیلتر تولیدکننده"
                    >
                      <option value="">همه تولیدکنندگان</option>
                      {producers.map((producer) => (
                        <option key={producer.id} value={producer.id}>
                          {producer.name}
                        </option>
                      ))}
                    </select>
                    <LuChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                  </div>
                </>
              )}

              {tab === 'workdays' && (
                <div className="relative sm:w-48">
                  <select
                    value={workdayFilter}
                    onChange={(event) => {
                      setWorkdayFilter(event.target.value)
                      setWorkdayPage(1)
                    }}
                    className="select py-2 text-[12px]"
                    aria-label="فیلتر گاری"
                  >
                    <option value="">همه گاری‌ها</option>
                    {GARRI_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <LuChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                </div>
              )}

              {((tab === 'records' && (searchTerm || producerFilter)) ||
                (tab === 'workdays' && workdayFilter)) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    setProducerFilter('')
                    setWorkdayFilter('')
                    setSearchTerm('')
                    setPage(1)
                    setWorkdayPage(1)
                  }}
                  className="btn-ghost px-2.5 py-2 text-[11px]"
                >
                  حذف فیلترها
                </button>
              )}
            </div>

            {tab === 'records' && (
              <>
                {recordsError ? (
                  <div className="p-4">
                    <ErrorState
                      title="دریافت سوابق ناموفق بود"
                      message={recordsError}
                      onRetry={loadRecords}
                    />
                  </div>
                ) : recordsLoading ? (
                  <TableRowsSkeleton />
                ) : records.length ? (
                  <>
                    <div className="hidden md:block table-wrap">
                      <table className="data-table min-w-[1180px]">
                        <thead>
                          <tr>
                            <th>محصول</th>
                            <th>تولیدکننده</th>
                            <th>گوشت تحویلی</th>
                            <th>گوشت تولیدی</th>
                            <th>تعداد بسته</th>
                            <th>معدومی</th>
                            <th>ضایعات</th>
                            <th>یادداشت</th>
                            <th>ثبت‌کننده</th>
                            <th>عملیات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedRecords.map((group) => (
                            <Fragment key={group.date}>
                              <tr className="bg-white/[0.03] hover:bg-white/[0.03]">
                                <td colSpan={10} className="!py-2.5">
                                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                    <LuCalendarDays className="size-3.5 text-meat-red/80" />
                                    <span className="font-semibold text-white/75">
                                      روز کاری {formatJalali(group.date, { withWeekday: true })}
                                    </span>
                                    <span className="text-white/20">•</span>
                                    <span className="text-white/40">
                                      {formatNumber(group.rows.length)} سابقه
                                    </span>
                                    <span className="text-white/20">•</span>
                                    <span className="text-white/40">
                                      مجموع تولید {formatKg(group.amount)}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {group.rows.map((record) => (
                                <tr key={record.id}>
                                  <td>
                                    <div className="flex items-center gap-2.5">
                                      <ProductAvatar
                                        name={record.product_name}
                                        image={record.product_image_url}
                                        size="sm"
                                      />
                                      <span className="font-medium text-white/85">
                                        {record.product_name}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <p className="font-medium text-white/85">
                                      {record.producer_name}
                                    </p>
                                    <p className="mt-1 text-[9px] text-white/30">
                                      {record.producer_role}
                                    </p>
                                  </td>
                                  <td className="text-white/70">
                                    {Number(record.delivered_meat_kg) > 0
                                      ? formatDecimal(record.delivered_meat_kg)
                                      : '—'}
                                    <span className="mr-1 text-[9px] text-white/30"> kg</span>
                                  </td>
                                  <td>
                                    <span className="font-bold text-white">
                                      {formatDecimal(record.amount_kg)}
                                    </span>
                                    <span className="mr-1 text-[9px] text-white/30"> kg</span>
                                  </td>
                                  <td className="text-white/70">
                                    {formatNumber(record.packages_count)}
                                  </td>
                                  <td className="text-white/70">
                                    {formatDecimal(record.waste_kg)}
                                    <span className="mr-1 text-[9px] text-white/30"> kg</span>
                                  </td>
                                  <td className="text-white/70">
                                    {formatDecimal(record.scrap_kg)}
                                    <span className="mr-1 text-[9px] text-white/30"> kg</span>
                                  </td>
                                  <td className="max-w-[190px] truncate text-white/50">
                                    {record.note || '—'}
                                  </td>
                                  <td className="text-white/55">{record.created_by_name}</td>
                                  <td>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setDetails(record)}
                                        className="btn-secondary !px-2.5 !py-1.5 text-[10px]"
                                      >
                                        <LuEye className="size-3.5" />
                                        مشاهده
                                      </button>
                                      {(user?.is_staff || record.created_by === user?.id) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDeleteTarget({ kind: 'records', item: record })
                                          }
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/[0.08] text-red-300/80 transition hover:bg-red-500/20 hover:text-red-200"
                                          aria-label={`حذف سابقه ${record.product_name}`}
                                        >
                                          <LuTrash2 className="size-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="divide-y divide-white/[0.055] md:hidden">
                      {groupedRecords.map((group) => (
                        <div key={group.date}>
                          <div className="flex flex-wrap items-center gap-2 bg-white/[0.03] px-4 py-2 text-[10px]">
                            <LuCalendarDays className="size-3.5 text-meat-red/80" />
                            <span className="font-semibold text-white/75">
                              {formatJalali(group.date, { withWeekday: true })}
                            </span>
                            <span className="text-white/25">•</span>
                            <span className="text-white/40">
                              {formatNumber(group.rows.length)} سابقه ·{' '}
                              {formatKg(group.amount)}
                            </span>
                          </div>
                          {group.rows.map((record) => (
                            <div key={record.id} className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <ProductAvatar
                                    name={record.product_name}
                                    image={record.product_image_url}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-[12px] font-semibold text-white/90">
                                      {record.producer_name}
                                    </p>
                                    <p className="mt-0.5 text-[9px] text-white/30">
                                      {record.producer_role}
                                    </p>
                                    <p className="mt-1 truncate text-[11px] text-white/55">
                                      {record.product_name}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white/[0.025] p-2.5 text-center">
                                <div>
                                  <p className="text-[9px] text-white/30">گوشت تولیدی</p>
                                  <p className="mt-1 text-[12px] font-bold text-white">
                                    {formatDecimal(record.amount_kg)}{' '}
                                    <span className="text-[8px] font-normal text-white/30">
                                      kg
                                    </span>
                                  </p>
                                </div>
                                <div className="border-r border-white/[0.06]">
                                  <p className="text-[9px] text-white/30">تعداد بسته</p>
                                  <p className="mt-1 text-[12px] font-bold text-white">
                                    {formatNumber(record.packages_count)}
                                  </p>
                                </div>
                                <div className="border-t border-white/[0.06] pt-2">
                                  <p className="text-[9px] text-white/30">معدومی</p>
                                  <p className="mt-1 text-[12px] font-bold text-white">
                                    {formatDecimal(record.waste_kg)}{' '}
                                    <span className="text-[8px] font-normal text-white/30">
                                      kg
                                    </span>
                                  </p>
                                </div>
                                <div className="border-r border-t border-white/[0.06] pt-2">
                                  <p className="text-[9px] text-white/30">ضایعات</p>
                                  <p className="mt-1 text-[12px] font-bold text-white">
                                    {formatDecimal(record.scrap_kg)}{' '}
                                    <span className="text-[8px] font-normal text-white/30">
                                      kg
                                    </span>
                                  </p>
                                </div>
                              </div>
                              {record.note && (
                                <p className="mt-2 rounded-lg bg-amber-400/[0.05] px-2.5 py-1.5 text-[10px] leading-5 text-amber-100/70">
                                  {record.note}
                                </p>
                              )}
                              <p className="mt-2 text-[9px] text-white/25">
                                ثبت‌کننده: {record.created_by_name}
                              </p>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDetails(record)}
                                  className="btn-secondary flex-1 !py-2 text-[11px]"
                                >
                                  <LuEye className="size-3.5" />
                                  مشاهده
                                </button>
                                {(user?.is_staff || record.created_by === user?.id) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteTarget({ kind: 'records', item: record })
                                    }
                                    className="btn-danger !py-2 text-[11px]"
                                  >
                                    <LuTrash2 className="size-3.5" />
                                    حذف
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-white/[0.055]">
                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        count={count}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPage}
                        itemLabel="سابقه"
                      />
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title={
                      searchTerm || producerFilter
                        ? 'سابقه‌ای با این فیلتر پیدا نشد'
                        : 'هنوز سابقه‌ای ثبت نشده'
                    }
                    description={
                      searchTerm || producerFilter
                        ? 'فیلترها را تغییر دهید یا عبارت جستجو را پاک کنید.'
                        : 'اولین آمار تولید را با فرم بالا ثبت کنید.'
                    }
                    icon={LuClipboardList}
                  />
                )}
              </>
            )}

            {tab === 'workdays' && (
              <WorkdayList
                rows={workdayRows}
                count={workdayCount}
                page={workdayPage}
                totalPages={workdayTotalPages}
                loading={workdayLoading}
                error={workdayError}
                filter={workdayFilter}
                user={user}
                onRetry={loadWorkdays}
                onPageChange={setWorkdayPage}
                onDeleteDay={(item) => setDeleteTarget({ kind: 'workday', item })}
                onDeleteCart={(item) => setDeleteTarget({ kind: 'cart', item })}
              />
            )}
          </section>
        </>
      )}

      <Modal
        open={Boolean(details)}
        onClose={() => setDetails(null)}
        title="جزئیات سابقه تولید"
        subtitle={details ? formatJalali(details.date, { withWeekday: true }) : ''}
        icon={LuEye}
        footer={
          <button type="button" className="btn-secondary" onClick={() => setDetails(null)}>
            بستن
          </button>
        }
      >
        {details && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-meat-red/20 bg-meat-red/[0.05] p-3.5">
              <ProductAvatar
                name={details.product_name}
                image={details.product_image_url}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{details.producer_name}</p>
                <p className="mt-1 text-[10px] text-red-200/70">{details.producer_role}</p>
                <p className="mt-1 text-[10px] text-white/35">
                  {details.product_name} · شناسه سابقه: {formatNumber(details.id)}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-[10px] text-white/35">گوشت تحویل داده شده</dt>
                <dd className="mt-1 font-bold text-white">
                  {Number(details.delivered_meat_kg) > 0
                    ? formatKg(details.delivered_meat_kg)
                    : '—'}
                </dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-[10px] text-white/35">گوشت تولید شده</dt>
                <dd className="mt-1 font-bold text-white">{formatKg(details.amount_kg)}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-[10px] text-white/35">تعداد بسته‌های تولید شده</dt>
                <dd className="mt-1 font-bold text-white">
                  {formatNumber(details.packages_count)} بسته
                </dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-[10px] text-white/35">وزن معدومی‌ها</dt>
                <dd className="mt-1 font-bold text-white">{formatKg(details.waste_kg)}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-[10px] text-white/35">وزن ضایعات</dt>
                <dd className="mt-1 font-bold text-white">{formatKg(details.scrap_kg)}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-[10px] text-white/35">تاریخ ثبت</dt>
                <dd className="mt-1 text-white/80">
                  {formatJalali(details.date, { withWeekday: true })}
                </dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-[10px] text-white/35">ثبت‌کننده</dt>
                <dd className="mt-1 text-white/80">{details.created_by_name}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-[10px] text-white/35">زمان ثبت در سامانه</dt>
                <dd className="mt-1 text-white/80">
                  {formatJalali(details.created_at?.slice(0, 10), { withWeekday: true })} —
                  ساعت {formatTime(details.created_at)}
                </dd>
              </div>
              {details.note && (
                <div className="col-span-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.05] p-3">
                  <dt className="flex items-center gap-1.5 text-[10px] text-amber-200/60">
                    <LuStickyNote className="size-3.5" />
                    یادداشت
                  </dt>
                  <dd className="mt-1.5 leading-6 text-amber-100/80">{details.note}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={
          deleteTarget?.kind === 'cart'
            ? 'حذف وزن گاری'
            : deleteTarget?.kind === 'workday'
              ? 'حذف روز کاری'
              : 'حذف سابقه تولید'
        }
        description={deleteDescription}
        confirmLabel="حذف"
        cancelLabel="انصراف"
      />
    </div>
  )
}
