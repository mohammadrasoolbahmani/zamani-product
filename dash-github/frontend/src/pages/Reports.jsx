import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  LuBeef,
  LuChartNoAxesCombined,
  LuDownload,
  LuFileSpreadsheet,
  LuLoaderCircle,
  LuPackage,
  LuRefreshCw,
  LuTrash2,
  LuTruck,
} from 'react-icons/lu'
import api from '../api/client'
import { getApiErrorMessage } from '../api/errors'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/PageHeader'
import JalaliDateInput from '../components/JalaliDateInput'
import { ProductAvatar } from '../components/BrandLogo'
import { EmptyState, ErrorState } from '../components/States'
import {
  formatCompact,
  formatDecimal,
  formatKg,
  formatNumber,
  formatPercent,
  faDigits,
} from '../utils/format'
import {
  addDays,
  formatJalali,
  formatJalaliNumeric,
  startOfJalaliMonthISO,
  todayISO,
} from '../utils/date'

const KPI_STYLES = {
  green: {
    card: 'border-emerald-500/20 bg-[linear-gradient(135deg,rgba(46,125,50,0.18),rgba(30,30,30,0.94)_62%)]',
    icon: 'bg-emerald-500/15 text-emerald-300',
  },
  blue: {
    card: 'border-sky-500/20 bg-[linear-gradient(135deg,rgba(25,118,210,0.2),rgba(30,30,30,0.94)_62%)]',
    icon: 'bg-sky-500/15 text-sky-300',
  },
  orange: {
    card: 'border-orange-500/20 bg-[linear-gradient(135deg,rgba(237,108,2,0.18),rgba(30,30,30,0.94)_62%)]',
    icon: 'bg-orange-500/15 text-orange-300',
  },
  purple: {
    card: 'border-purple-500/20 bg-[linear-gradient(135deg,rgba(123,31,162,0.2),rgba(30,30,30,0.94)_62%)]',
    icon: 'bg-purple-500/15 text-purple-300',
  },
}

function fillDays(start, end, rows) {
  const lookup = new Map(rows.map((row) => [row.date, row]))
  const output = []
  let cursor = start
  let guard = 0
  while (cursor && cursor <= end && guard < 367) {
    const row = lookup.get(cursor)
    output.push({
      date: cursor,
      amount_kg: row?.amount_kg ?? 0,
      packages_count: row?.packages_count ?? 0,
    })
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return output
}

function ReportTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="chart-tooltip">
      <p className="mb-2 font-semibold text-white">{formatJalali(row.date, { withWeekday: true })}</p>
      <p className="text-white/70">{formatKg(row.amount_kg)}</p>
      <p className="mt-1 text-[10px] text-white/40">{formatNumber(row.packages_count)} بسته</p>
    </div>
  )
}

function KpiCard({ title, value, unit, icon: Icon, tone, hint }) {
  const styles = KPI_STYLES[tone]
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-panel sm:p-5 ${styles.card}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`icon-box h-9 w-9 sm:h-10 sm:w-10 ${styles.icon}`}>
          <Icon className="size-[18px] sm:size-5" />
        </span>
        <p className="pt-1 text-[10.5px] leading-5 text-white/55 sm:text-[12px]">{title}</p>
      </div>
      <p className="mt-3 text-[21px] font-extrabold leading-none text-white sm:mt-4 sm:text-[26px]">{value}</p>
      <p className="mt-1.5 text-[9px] text-white/35 sm:text-[10px]">{unit}</p>
      {hint && <p className="mt-2.5 border-t border-white/[0.07] pt-2 text-[9px] leading-4 text-white/35 sm:mt-3 sm:pt-2.5 sm:text-[10px]">{hint}</p>}
    </div>
  )
}

export default function Reports() {
  const { user } = useAuth()
  const toast = useToast()
  const canExportExcel = Boolean(user?.is_staff)
  const [exportingExcel, setExportingExcel] = useState(false)
  const initialStart = startOfJalaliMonthISO()
  const initialEnd = todayISO()

  const [draft, setDraft] = useState({ start: initialStart, end: initialEnd })
  const [query, setQuery] = useState({ start: initialStart, end: initialEnd })
  const [draftError, setDraftError] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      setError('')
      try {
        const { data } = await api.get('/reports/summary/', {
          params: { start: query.start, end: query.end },
        })
        setReport(data)
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'دریافت گزارش تولید ناموفق بود.'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [query.start, query.end],
  )

  useEffect(() => {
    load()
  }, [load])

  const applyRange = (start, end) => {
    if (!start || !end) {
      setDraftError('هر دو تاریخ شروع و پایان را وارد کنید.')
      return false
    }
    if (start > end) {
      setDraftError('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.')
      return false
    }
    setDraftError('')
    setDraft({ start, end })
    setQuery({ start, end })
    return true
  }

  const presetDays = (days) => {
    const end = todayISO()
    const start = addDays(end, -(days - 1))
    applyRange(start, end)
  }

  const presetMonth = () => {
    applyRange(startOfJalaliMonthISO(), todayISO())
  }

  const chartData = useMemo(() => {
    if (!report) return []
    return fillDays(report.start, report.end, report.by_day)
  }, [report])

  const exportCsv = () => {
    if (!report) return
    const header = [
      'محصول',
      'گوشت تحویل داده شده (کیلوگرم)',
      'گوشت تولید شده (کیلوگرم)',
      'وزن معدومی‌ها (کیلوگرم)',
      'تعداد بسته',
      'تعداد سابقه',
    ]
    const lines = [
      header.join(','),
      ...report.by_product.map((row) =>
        [
          `"${row.name.replaceAll('"', '""')}"`,
          row.delivered_meat_kg,
          row.amount_kg,
          row.waste_kg,
          row.packages_count,
          row.records_count,
        ].join(','),
      ),
    ]
    const csv = `\uFEFF${lines.join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `zamaniburger-report-${report.start}-to-${report.end}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success('گزارش CSV دانلود شد.')
  }

  const exportExcel = async () => {
    if (!report || exportingExcel) return
    setExportingExcel(true)
    try {
      const response = await api.get('/reports/export/', {
        params: { start: query.start, end: query.end },
        responseType: 'blob',
      })
      const disposition = response.headers['content-disposition'] || ''
      const filenameMatch = /filename="?([^";]+)"?/.exec(disposition)
      const filename =
        filenameMatch?.[1] ||
        `zamaniburger-production-${query.start}-to-${query.end}.xlsx`
      const blob = new Blob([response.data], {
        type:
          response.headers['content-type'] ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('فایل اکسل گزارش دانلود شد.')
    } catch (requestError) {
      let message = getApiErrorMessage(requestError, 'دانلود فایل اکسل ناموفق بود.')
      if (requestError.response?.data instanceof Blob) {
        try {
          const payload = JSON.parse(await requestError.response.data.text())
          message = payload.detail || payload.end?.[0] || payload.start?.[0] || message
        } catch {
          // Keep the fallback message when the response is not JSON.
        }
      }
      toast.error(message)
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="تحلیل عملکرد"
        title="گزارش‌گیری تولید"
        description="بازه زمانی را انتخاب کنید و عملکرد تولید و بسته‌بندی را تحلیل کنید."
        icon={LuChartNoAxesCombined}
        actions={
          <>
            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={loading || refreshing}
              className="btn-secondary"
            >
              <LuRefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              به‌روزرسانی
            </button>
            {canExportExcel && (
              <button
                type="button"
                onClick={exportExcel}
                disabled={!report || !report.by_product.length || exportingExcel}
                className="btn-primary"
                title="دانلود گزارش در قالب Excel"
              >
                {exportingExcel ? (
                  <LuLoaderCircle className="size-4 animate-spin" />
                ) : (
                  <LuFileSpreadsheet className="size-4" />
                )}
                {exportingExcel ? 'در حال آماده‌سازی…' : 'دانلود اکسل'}
              </button>
            )}
            <button
              type="button"
              onClick={exportCsv}
              disabled={!report || !report.by_product.length}
              className="btn-secondary"
            >
              <LuDownload className="size-4" />
              خروجی CSV
            </button>
          </>
        }
      />

      <section className="panel mb-4 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label htmlFor="report-start" className="field-label">
              از تاریخ
            </label>
            <JalaliDateInput
              id="report-start"
              value={draft.start}
              onChange={(value) => {
                setDraft((current) => ({ ...current, start: value }))
                setDraftError('')
              }}
            />
          </div>
          <div>
            <label htmlFor="report-end" className="field-label">
              تا تاریخ
            </label>
            <JalaliDateInput
              id="report-end"
              value={draft.end}
              onChange={(value) => {
                setDraft((current) => ({ ...current, end: value }))
                setDraftError('')
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => applyRange(draft.start, draft.end)}
            className="btn-primary lg:mb-0"
          >
            <LuFileSpreadsheet className="size-4" />
            اعمال بازه
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-white/30">بازه‌های سریع:</span>
          {[
            { label: '۷ روز اخیر', action: () => presetDays(7) },
            { label: '۳۰ روز اخیر', action: () => presetDays(30) },
            { label: 'این ماه', action: presetMonth },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={preset.action}
              className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] text-white/45 transition hover:border-white/20 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
          <span className="mr-auto text-[10px] text-white/35">
            {report
              ? `${formatJalali(report.start)} تا ${formatJalali(report.end)} — ${faDigits(report.days)} روز`
              : 'در حال محاسبه…'}
          </span>
        </div>
        {draftError && <p className="mt-2 text-[10px] text-red-300">{draftError}</p>}
      </section>

      {error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="panel h-[152px] p-5">
                <div className="skeleton h-9 w-9" />
                <div className="skeleton mt-5 h-7 w-28" />
                <div className="skeleton mt-4 h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="panel mt-4 h-[370px] p-6">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton mt-10 h-[260px] w-full" />
          </div>
        </>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard
              title="گوشت تحویل داده شده"
              value={formatDecimal(report.totals.delivered_meat_kg)}
              unit="کیلوگرم"
              icon={LuTruck}
              tone="green"
              hint={`${formatNumber(report.totals.records_count)} سابقه در ${faDigits(report.days)} روز`}
            />
            <KpiCard
              title="گوشت تولید شده"
              value={formatDecimal(report.totals.amount_kg)}
              unit="کیلوگرم"
              icon={LuBeef}
              tone="blue"
              hint={`میانگین روزانه ${formatKg(report.totals.daily_average_kg)}`}
            />
            <KpiCard
              title="تعداد بسته"
              value={formatNumber(report.totals.packages_count)}
              unit="بسته"
              icon={LuPackage}
              tone="orange"
              hint={`${formatNumber(report.by_product.length)} محصول در این بازه`}
            />
            <KpiCard
              title="وزن معدومی‌ها"
              value={formatDecimal(report.totals.waste_kg)}
              unit="کیلوگرم"
              icon={LuTrash2}
              tone="purple"
              hint={`${formatPercent(
                report.totals.amount_kg
                  ? (report.totals.waste_kg / report.totals.amount_kg) * 100
                  : 0,
              )} از وزن تولید`}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <section className="panel xl:col-span-2">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <LuChartNoAxesCombined className="size-[18px] text-meat-red" />
                    تولید روزانه در بازه انتخابی
                  </h2>
                  <p className="panel-subtitle">مقدار تولید هر روز بر حسب کیلوگرم</p>
                </div>
                <span className="text-[10px] text-white/35">{faDigits(report.days)} روز</span>
              </div>
              {chartData.some((row) => row.amount_kg > 0) ? (
                <div className="h-[300px] w-full p-3 sm:p-4" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 12, right: 10, left: 4, bottom: 0 }}>
                      <CartesianGrid
                        strokeDasharray="3 5"
                        vertical={false}
                        stroke="rgba(255,255,255,0.055)"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                          const parts = formatJalaliNumeric(value).split('/')
                          return parts.slice(-2).join('/')
                        }}
                        tick={{ fill: '#8f8f8f', fontSize: 9, fontFamily: 'Vazirmatn' }}
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
                        content={<ReportTooltip />}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar
                        dataKey="amount_kg"
                        fill="#d52222"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="در این بازه تولیدی ثبت نشده"
                  description="بازه دیگری را انتخاب کنید یا ابتدا آمار تولید را ثبت کنید."
                  icon={LuChartNoAxesCombined}
                />
              )}
            </section>

          </div>

          <section className="panel mt-4 min-w-0 overflow-hidden">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <LuPackage className="size-[18px] text-sky-300" />
                  عملکرد محصولات
                </h2>
                <p className="panel-subtitle">جزئیات تولید به تفکیک محصول در بازه انتخابی</p>
              </div>
              <span className="text-[10px] text-white/30">
                {formatNumber(report.by_product.length)} محصول
              </span>
            </div>
            {report.by_product.length ? (
              <div className="table-wrap">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>محصول</th>
                      <th>گوشت تحویلی</th>
                      <th>گوشت تولیدی</th>
                      <th>معدومی</th>
                      <th>تعداد بسته</th>
                      <th>تعداد سابقه</th>
                      <th>سهم از تولید</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_product.map((row) => {
                      const share = report.totals.amount_kg
                        ? (row.amount_kg / report.totals.amount_kg) * 100
                        : 0
                      return (
                        <tr key={row.product_id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <ProductAvatar name={row.name} size="sm" />
                              <span className="font-medium text-white/85">{row.name}</span>
                            </div>
                          </td>
                          <td className="text-white/65">{formatDecimal(row.delivered_meat_kg)} kg</td>
                          <td className="font-semibold text-white">{formatDecimal(row.amount_kg)} kg</td>
                          <td className="text-white/65">{formatDecimal(row.waste_kg)} kg</td>
                          <td>{formatNumber(row.packages_count)}</td>
                          <td>{formatNumber(row.records_count)}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className="h-full rounded-full bg-meat-red"
                                  style={{ width: `${Math.max(share, 1)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-white/45">{formatPercent(share)}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="محصولی در این بازه تولید نشده"
                description="بازه گزارش را تغییر دهید تا داده‌ها نمایش داده شوند."
              />
            )}
          </section>

          <section className="panel mt-4 min-w-0 overflow-hidden">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <LuTruck className="size-[18px] text-emerald-300" />
                  عملکرد تولیدکنندگان
                </h2>
                <p className="panel-subtitle">
                  تولید و ضایعات هر تولیدکننده در بازه انتخابی
                </p>
              </div>
              <span className="text-[10px] text-white/30">
                {formatNumber(report.by_producer.length)} تولیدکننده
              </span>
            </div>
            {report.by_producer.length ? (
              <div className="table-wrap">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>تولیدکننده</th>
                      <th>سمت</th>
                      <th>گوشت تحویلی</th>
                      <th>گوشت تولیدی</th>
                      <th>معدومی</th>
                      <th>تعداد بسته</th>
                      <th>سوابق</th>
                      <th>سهم از تولید</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_producer.map((row) => {
                      const share = report.totals.amount_kg
                        ? (row.amount_kg / report.totals.amount_kg) * 100
                        : 0
                      return (
                        <tr key={row.producer_id}>
                          <td className="font-medium text-white/85">{row.name}</td>
                          <td>
                            <span className="chip border-white/10 bg-white/[0.04] text-white/55">
                              {row.role}
                            </span>
                          </td>
                          <td className="text-white/65">
                            {formatDecimal(row.delivered_meat_kg)} kg
                          </td>
                          <td className="font-semibold text-white">
                            {formatDecimal(row.amount_kg)} kg
                          </td>
                          <td className="text-white/65">{formatDecimal(row.waste_kg)} kg</td>
                          <td>{formatNumber(row.packages_count)}</td>
                          <td>{formatNumber(row.records_count)}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${Math.max(share, 1)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-white/45">{formatPercent(share)}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="تولیدی برای تولیدکنندگان ثبت نشده"
                description="با ثبت آمار، عملکرد تولیدکنندگان در این بخش نمایش داده می‌شود."
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
