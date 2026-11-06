import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  LuArrowLeft,
  LuBeef,
  LuCalendarDays,
  LuCalendarRange,
  LuChartNoAxesCombined,
  LuChartPie,
  LuPackage,
  LuPlus,
  LuRefreshCw,
  LuTrash2,
  LuTruck,
} from 'react-icons/lu'
import api from '../api/client'
import { getApiErrorMessage } from '../api/errors'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import PeriodFilter from '../components/PeriodFilter'
import BrandLogo, { ProductAvatar } from '../components/BrandLogo'
import { ErrorState, EmptyState } from '../components/States'
import {
  formatCompact,
  formatDecimal,
  formatKg,
  formatNumber,
  formatPercent,
} from '../utils/format'
import {
  daysBetweenISO,
  formatJalali,
  formatJalaliMonth,
  formatJalaliNumeric,
  formatJalaliRange,
  formatShortWeekday,
  formatTime,
  getPeriodRange,
  startOfJalaliMonthISO,
  todayISO,
  toJalaliParts,
} from '../utils/date'

const PIE_COLORS = ['#e02a2a', '#f59e0b', '#1976d2', '#2e7d32', '#7b1fa2', '#64748b']

function buildChartData(rows, start, end) {
  const days = daysBetweenISO(start, end)
  if (days <= 31) {
    return rows.map((row) => ({
      ...row,
      label:
        days <= 7
          ? formatShortWeekday(row.date)
          : formatJalaliNumeric(row.date).split('/').slice(-2).join('/'),
      tooltipLabel: formatJalali(row.date, { withWeekday: true }),
    }))
  }

  if (days <= 120) {
    const buckets = []
    rows.forEach((row, index) => {
      const bucketIndex = Math.floor(index / 7)
      if (!buckets[bucketIndex]) {
        buckets[bucketIndex] = {
          key: `week-${bucketIndex}`,
          start: row.date,
          end: row.date,
          amount_kg: 0,
          packages_count: 0,
        }
      }
      const bucket = buckets[bucketIndex]
      bucket.end = row.date
      bucket.amount_kg += Number(row.amount_kg || 0)
      bucket.packages_count += Number(row.packages_count || 0)
    })
    return buckets.map((bucket) => ({
      ...bucket,
      amount_kg: Math.round(bucket.amount_kg * 100) / 100,
      label: formatJalali(bucket.start, { withYear: false }),
      tooltipLabel: `${formatJalali(bucket.start)} تا ${formatJalali(bucket.end)}`,
    }))
  }

  const buckets = new Map()
  rows.forEach((row) => {
    const parts = toJalaliParts(row.date)
    const key = `${parts.jy}-${parts.jm}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: formatJalaliMonth(row.date),
        tooltipLabel: `${formatJalaliMonth(row.date)} ${parts.jy}`,
        amount_kg: 0,
        packages_count: 0,
      })
    }
    const bucket = buckets.get(key)
    bucket.amount_kg += Number(row.amount_kg || 0)
    bucket.packages_count += Number(row.packages_count || 0)
  })
  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    amount_kg: Math.round(bucket.amount_kg * 100) / 100,
  }))
}

function ProductionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="chart-tooltip">
      <p className="mb-2 font-semibold text-white">{row.tooltipLabel}</p>
      <p className="flex items-center gap-1.5 text-white/70">
        <span className="h-1.5 w-1.5 rounded-full bg-meat-red" />
        {formatKg(row.amount_kg)}
      </p>
      <p className="mt-1 text-[10px] text-white/40">{formatNumber(row.packages_count)} بسته</p>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="panel h-[386px] p-5">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-3 h-3 w-56" />
      <div className="skeleton mt-8 h-[260px] w-full" />
    </div>
  )
}

export default function Dashboard() {
  const initialRange = useMemo(() => getPeriodRange('daily'), [])
  const [periodMode, setPeriodMode] = useState('daily')
  const [range, setRange] = useState(initialRange)
  const [productType, setProductType] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [draft, setDraft] = useState({
    start: startOfJalaliMonthISO(),
    end: todayISO(),
  })
  const [filterError, setFilterError] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const toast = useToast()
  const loadRequest = useRef(0)

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = loadRequest.current + 1
      loadRequest.current = requestId
      if (silent) setRefreshing(true)
      else setLoading(true)
      setError('')
      try {
        const params = { start: range.start, end: range.end }
        if (productType) params.product_type = productType
        const [statsResponse, chartResponse, distributionResponse, recordsResponse] =
          await Promise.all([
            api.get('/stats/', { params }),
            api.get('/chart/production/', { params }),
            api.get('/chart/distribution/', { params }),
            api.get('/records/', {
              params: { product_type: productType, page_size: 5 },
            }),
          ])
        if (requestId !== loadRequest.current) return
        setData({
          stats: statsResponse.data,
          chart: chartResponse.data.results,
          distribution: distributionResponse.data,
          records: recordsResponse.data.results,
          recordsCount: recordsResponse.data.count,
        })
        setUpdatedAt(new Date())
      } catch (requestError) {
        if (requestId !== loadRequest.current) return
        setError(getApiErrorMessage(requestError, 'دریافت اطلاعات داشبورد ناموفق بود.'))
      } finally {
        if (requestId === loadRequest.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [range.start, range.end, productType],
  )

  useEffect(() => {
    load()
  }, [load])

  const selectPreset = (key) => {
    const next = getPeriodRange(key)
    setPeriodMode(key)
    setRange(next)
    setCustomOpen(false)
    setFilterError('')
  }

  const openCustom = () => {
    setDraft((current) => ({
      start: current.start || range.start,
      end: current.end || range.end,
    }))
    setCustomOpen(true)
    setFilterError('')
  }

  const changeDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setFilterError('')
  }

  const applyCustom = () => {
    if (!draft.start || !draft.end) {
      setFilterError('تاریخ شروع و پایان را وارد کنید.')
      return
    }
    if (draft.start > draft.end) {
      setFilterError('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.')
      return
    }
    if (draft.end > todayISO()) {
      setFilterError('تاریخ پایان نمی‌تواند در آینده باشد.')
      return
    }
    if (daysBetweenISO(draft.start, draft.end) > 366) {
      setFilterError('بازه انتخابی نمی‌تواند بیشتر از یک سال باشد.')
      return
    }
    setPeriodMode('custom')
    setRange({ start: draft.start, end: draft.end })
    setCustomOpen(false)
    setFilterError('')
  }

  const handleRefresh = async () => {
    await load({ silent: true })
    toast.success('اطلاعات داشبورد به‌روزرسانی شد.')
  }

  const stats = data?.stats
  const chartRows = data?.chart ?? []
  const chartData = useMemo(
    () => buildChartData(chartRows, range.start, range.end),
    [chartRows, range.start, range.end],
  )
  const distribution = data?.distribution
  const records = data?.records ?? []
  const rangeDays = daysBetweenISO(range.start, range.end)
  const bucketLabel = rangeDays <= 31 ? 'روزانه' : rangeDays <= 120 ? 'هفتگی' : 'ماهانه'
  const hasProduction = (stats?.totals.amount_kg || 0) > 0

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="نمای کلی کارخانه"
        title="داشبورد مدیریت"
        description="تولید را در بازه‌های روزانه، هفتگی، ماهانه، سالانه یا بازه دلخواه پایش کنید."
        actions={
          <>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="btn-secondary"
            >
              <LuRefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              به‌روزرسانی
            </button>
            <Link to="/production" className="btn-primary">
              <LuPlus className="size-4" />
              ثبت تولید
            </Link>
          </>
        }
      />

      <PeriodFilter
        mode={periodMode}
        range={range}
        customOpen={customOpen}
        draft={draft}
        error={filterError}
        productType={productType}
        onSelectPreset={selectPreset}
        onOpenCustom={openCustom}
        onDraftChange={changeDraft}
        onApplyCustom={applyCustom}
        onSelectProductType={setProductType}
        disabled={loading && !data}
      />

      {error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <StatCard key={item} loading />
            ))}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartSkeleton />
            </div>
            <div className="panel h-[386px] p-5">
              <div className="skeleton h-4 w-36" />
              <div className="skeleton mx-auto mt-10 h-44 w-44 rounded-full" />
              <div className="skeleton mx-auto mt-8 h-3 w-48" />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-[10px] text-white/30">
              {updatedAt
                ? `آخرین به‌روزرسانی: ${formatTime(updatedAt.toISOString())}`
                : 'داده‌های زنده از سرور'}
            </p>
            <p className="flex items-center gap-1.5 text-[10px] text-white/30">
              <LuCalendarRange className="size-3.5" />
              {formatJalaliRange(range.start, range.end)}
              <span className="text-white/15">•</span>
              {formatNumber(rangeDays)} روز
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              title="گوشت تحویل داده شده"
              value={formatDecimal(stats.totals.delivered_meat_kg)}
              unit="کیلوگرم در بازه"
              change={stats.changes.delivered_meat_kg}
              icon={LuTruck}
              tone="green"
              comparisonLabel="نسبت به دوره قبل"
              delayClass="stagger-1"
            />
            <StatCard
              title="گوشت تولید شده"
              value={formatDecimal(stats.totals.amount_kg)}
              unit="کیلوگرم در بازه"
              change={stats.changes.amount_kg}
              icon={LuBeef}
              tone="blue"
              comparisonLabel="نسبت به دوره قبل"
              delayClass="stagger-2"
            />
            <StatCard
              title="تعداد بسته"
              value={formatNumber(stats.totals.packages_count)}
              unit="بسته‌بندی‌شده در بازه"
              change={stats.changes.packages_count}
              icon={LuPackage}
              tone="orange"
              comparisonLabel="نسبت به دوره قبل"
              delayClass="stagger-3"
            />
            <StatCard
              title="وزن معدومی‌ها"
              value={formatDecimal(stats.totals.waste_kg)}
              unit="کیلوگرم در بازه"
              change={stats.changes.waste_kg}
              icon={LuTrash2}
              tone="purple"
              comparisonLabel="نسبت به دوره قبل"
              invertTrend
              delayClass="stagger-4"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <section className="panel min-w-0 overflow-hidden xl:col-span-2">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <LuChartNoAxesCombined className="size-[18px] text-meat-red" />
                    روند تولید در بازه انتخابی
                  </h2>
                  <p className="panel-subtitle">
                    تجمیع {bucketLabel} تولید در {formatJalaliRange(range.start, range.end)}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-white/35">
                  <span className="h-2 w-2 rounded-full bg-meat-red" />
                  کیلوگرم
                </span>
              </div>
              {hasProduction ? (
                <div className="p-3 pb-4 sm:p-4">
                  <div className="h-[286px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 12, right: 10, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="productionFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e02a2a" stopOpacity={0.34} />
                            <stop offset="65%" stopColor="#c91c1c" stopOpacity={0.08} />
                            <stop offset="100%" stopColor="#c91c1c" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 5"
                          vertical={false}
                          stroke="rgba(255,255,255,0.055)"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: '#8f8f8f', fontSize: 10, fontFamily: 'Vazirmatn' }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={18}
                          dy={8}
                        />
                        <YAxis
                          tickFormatter={(value) => formatCompact(value)}
                          tick={{ fill: '#777777', fontSize: 9, fontFamily: 'Vazirmatn' }}
                          axisLine={false}
                          tickLine={false}
                          width={62}
                        />
                        <Tooltip
                          content={<ProductionTooltip />}
                          cursor={{ stroke: 'rgba(255,255,255,0.13)' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="amount_kg"
                          stroke="#ef3b3b"
                          strokeWidth={2.4}
                          fill="url(#productionFill)"
                          isAnimationActive={false}
                          activeDot={{ r: 5, fill: '#121212', stroke: '#ef3b3b', strokeWidth: 2.5 }}
                          dot={{ r: 3.4, fill: '#121212', stroke: '#ef3b3b', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="در این بازه تولیدی ثبت نشده"
                  description="با ثبت آمار تولید، روند این بازه به‌صورت خودکار ترسیم می‌شود."
                  icon={LuChartNoAxesCombined}
                  action={
                    <Link to="/production" className="btn-primary">
                      <LuPlus className="size-4" />
                      ثبت تولید
                    </Link>
                  }
                />
              )}
            </section>

            <section className="panel flex flex-col">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <LuChartPie className="size-[18px] text-orange-300" />
                    توزیع تولید در بازه
                  </h2>
                  <p className="panel-subtitle">سهم محصولات از تولید بازه</p>
                </div>
              </div>

              {distribution?.items?.length ? (
                <div className="flex flex-1 flex-col p-4">
                  <div className="relative mx-auto h-[186px] w-full max-w-[250px]" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distribution.items}
                          dataKey="amount_kg"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={80}
                          paddingAngle={3}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {distribution.items.map((item, index) => (
                            <Cell key={item.product_id} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [formatKg(value), name]}
                          contentStyle={{
                            background: '#1b1b1b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            fontSize: 11,
                            direction: 'rtl',
                            fontFamily: 'Vazirmatn',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[20px] font-extrabold text-white">
                        {formatCompact(distribution.total_kg)}
                      </span>
                      <span className="mt-1 text-[10px] text-white/35">کیلوگرم در بازه</span>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {distribution.items.map((item, index) => (
                      <div key={item.product_id} className="flex items-center gap-2 text-[11px]">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="min-w-0 flex-1 truncate text-white/60">{item.name}</span>
                        <span className="font-semibold text-white/80">
                          {formatPercent(item.percentage)}
                        </span>
                        <span className="w-16 text-left text-white/35">{formatCompact(item.amount_kg)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="تولیدی در این بازه ثبت نشده"
                  description="پس از ثبت تولید، نمودار توزیع محصولات ساخته می‌شود."
                  icon={LuChartPie}
                />
              )}
            </section>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-5">
            <section className="panel min-w-0 overflow-hidden xl:col-span-2">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <LuPackage className="size-[18px] text-sky-300" />
                    خلاصه آمار محصولات
                  </h2>
                  <p className="panel-subtitle">مقدار تولید در بازه انتخابی</p>
                </div>
                <Link to="/reports" className="link-subtle flex items-center gap-1">
                  گزارش کامل
                  <LuArrowLeft className="size-3" />
                </Link>
              </div>
              <div className="p-4">
                {distribution?.items?.length ? (
                  <div className="space-y-4">
                    {distribution.items.map((item, index) => (
                      <div key={item.product_id}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <ProductAvatar name={item.name} image={item.image} size="sm" />
                            <span className="truncate text-[12px] text-white/75">{item.name}</span>
                          </div>
                          <div className="shrink-0 text-left">
                            <span className="text-[12px] font-semibold text-white">
                              {formatDecimal(item.amount_kg)}
                            </span>
                            <span className="mr-1 text-[9px] text-white/35">کیلوگرم</span>
                          </div>
                        </div>
                        <div className="mr-[46px] mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max(item.percentage, 2)}%`,
                              backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10px] text-white/35">
                      <span>{formatNumber(stats.totals.records_count)} سابقه در بازه</span>
                      <span>{formatNumber(stats.totals.products_count)} محصول</span>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="آماری برای نمایش نیست" />
                )}
              </div>
            </section>

            <section className="panel min-w-0 overflow-hidden xl:col-span-3">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <LuCalendarDays className="size-[18px] text-orange-300" />
                    آخرین سوابق تولید
                  </h2>
                  <p className="panel-subtitle">
                    {formatNumber(data.recordsCount)} سابقه ثبت‌شده
                    {productType
                      ? ` برای محصولات ${productType === '60' ? '۶۰' : '۹۰'} درصد`
                      : ' در سامانه'}
                  </p>
                </div>
                <Link to="/production" className="link-subtle flex items-center gap-1">
                  مدیریت سوابق
                  <LuArrowLeft className="size-3" />
                </Link>
              </div>

              {records.length ? (
                <>
                  <div className="hidden md:block table-wrap">
                    <table className="data-table min-w-[1000px]">
                      <thead>
                        <tr>
                          <th>تولیدکننده</th>
                          <th>محصول</th>
                          <th>گوشت تحویلی</th>
                          <th>گوشت تولیدی</th>
                          <th>تعداد بسته</th>
                          <th>معدومی</th>
                          <th>ضایعات</th>
                          <th>تاریخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td>
                              <p className="text-white/80">{record.producer_name}</p>
                              <p className="mt-1 text-[9px] text-white/30">{record.producer_role}</p>
                            </td>
                            <td>
                              <div className="flex items-center gap-2.5">
                                <ProductAvatar
                                  name={record.product_name}
                                  image={record.product_image_url}
                                  size="sm"
                                />
                                <span className="text-white/80">{record.product_name}</span>
                              </div>
                            </td>
                            <td className="text-white/65">
                              {formatDecimal(record.delivered_meat_kg)}
                              <span className="mr-1 text-[9px] font-normal text-white/30"> kg</span>
                            </td>
                            <td className="font-semibold text-white">
                              {formatDecimal(record.amount_kg)}
                              <span className="mr-1 text-[9px] font-normal text-white/30"> kg</span>
                            </td>
                            <td>{formatNumber(record.packages_count)}</td>
                            <td className="text-white/65">
                              {formatDecimal(record.waste_kg)}
                              <span className="mr-1 text-[9px] font-normal text-white/30"> kg</span>
                            </td>
                            <td className="text-white/65">
                              {formatDecimal(record.scrap_kg)}
                              <span className="mr-1 text-[9px] font-normal text-white/30"> kg</span>
                            </td>
                            <td className="text-white/55">{formatJalali(record.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="divide-y divide-white/[0.055] md:hidden">
                    {records.map((record) => (
                      <div key={record.id} className="flex items-start gap-3 px-4 py-3.5">
                        <ProductAvatar
                          name={record.product_name}
                          image={record.product_image_url}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-white/85">
                            {record.producer_name}
                          </p>
                          <p className="mt-0.5 text-[9px] text-white/30">{record.producer_role}</p>
                          <p className="mt-1 truncate text-[10px] text-white/45">
                            {record.product_name} · {formatJalali(record.date)}
                          </p>
                        </div>
                        <div className="shrink-0 text-left">
                          <p className="text-[11px] font-bold text-white">
                            {formatDecimal(record.amount_kg)}{' '}
                            <span className="text-[8px] font-normal text-white/30">kg</span>
                          </p>
                          <p className="mt-1 text-[9px] text-white/30">
                            معدومی {formatDecimal(record.waste_kg)} · ضایعات{' '}
                            {formatDecimal(record.scrap_kg)}
                          </p>
                          <p className="mt-1 text-[9px] text-white/30">
                            {formatNumber(record.packages_count)} بسته
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="هنوز سابقه‌ای ثبت نشده"
                  description="برای شروع، اولین آمار تولید را ثبت کنید."
                  action={
                    <Link to="/production" className="btn-primary">
                      <LuPlus className="size-4" />
                      ثبت تولید
                    </Link>
                  }
                />
              )}
            </section>
          </div>

          <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[10px] text-white/25 sm:flex-row">
            <div className="flex items-center gap-2">
              <BrandLogo compact size="sm" />
              <span>داده‌ها مستقیماً از API تولید ZAMANI BURGER خوانده می‌شوند.</span>
            </div>
            <span className="flex items-center gap-1.5">
              <LuCalendarDays className="size-3.5" />
              {formatJalali(todayISO(), { withWeekday: true })}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
