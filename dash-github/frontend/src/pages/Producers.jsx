import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LuLoaderCircle,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTruck,
  LuUserCheck,
  LuUserX,
  LuUsersRound,
} from 'react-icons/lu'
import api from '../api/client'
import { getApiErrorMessage, getFieldErrors } from '../api/errors'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState, ErrorState } from '../components/States'
import { StatusBadge } from '../components/Badges'
import { formatNumber } from '../utils/format'

const emptyForm = { name: '', role: '', sort_order: 0, is_active: true }

export default function Producers() {
  const { user } = useAuth()
  const toast = useToast()
  const canManage = Boolean(user?.is_staff)

  const [producers, setProducers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/producers/?page_size=100')
      setProducers(data.results ?? data)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'دریافت فهرست تولیدکنندگان ناموفق بود.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return producers
    return producers.filter((producer) =>
      [producer.name, producer.role].some((value) =>
        String(value || '').toLowerCase().includes(term),
      ),
    )
  }, [producers, search])

  const stats = useMemo(
    () => ({
      total: producers.length,
      active: producers.filter((producer) => producer.is_active).length,
      records: producers.reduce((sum, producer) => sum + (producer.records_count || 0), 0),
    }),
    [producers],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFieldErrors({})
    setFormOpen(true)
  }

  const openEdit = (producer) => {
    setEditing(producer)
    setForm({
      name: producer.name,
      role: producer.role,
      sort_order: producer.sort_order,
      is_active: producer.is_active,
    })
    setFieldErrors({})
    setFormOpen(true)
  }

  const changeField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const handleSave = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!form.name.trim()) errors.name = 'نام تولیدکننده را وارد کنید.'
    if (!form.role.trim()) errors.role = 'سمت یا سهم تولیدکننده را وارد کنید.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role.trim(),
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      }
      if (editing) {
        const { data } = await api.patch(`/producers/${editing.id}/`, payload)
        setProducers((current) => current.map((item) => (item.id === data.id ? data : item)))
        toast.success('اطلاعات تولیدکننده به‌روزرسانی شد.')
      } else {
        const { data } = await api.post('/producers/', payload)
        setProducers((current) =>
          [...current, data].sort(
            (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'fa'),
          ),
        )
        toast.success(`تولیدکننده «${data.name}» ایجاد شد.`)
      }
      setFormOpen(false)
    } catch (requestError) {
      setFieldErrors(getFieldErrors(requestError))
      toast.error(getApiErrorMessage(requestError, 'ذخیره تولیدکننده ناموفق بود.'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const { data } = await api.patch(`/producers/${toggleTarget.id}/`, {
        is_active: !toggleTarget.is_active,
      })
      setProducers((current) => current.map((item) => (item.id === data.id ? data : item)))
      toast.success(data.is_active ? 'تولیدکننده فعال شد.' : 'تولیدکننده غیرفعال شد.')
      setToggleTarget(null)
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'تغییر وضعیت تولیدکننده ناموفق بود.'))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="مدیریت زنجیره تولید"
        title="مدیریت تولیدکنندگان"
        description="تولیدکنندگان و سهم هر یک را مدیریت کنید؛ این فهرست در فرم ثبت آمار تولید استفاده می‌شود."
        icon={LuUsersRound}
        actions={
          canManage ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              <LuPlus className="size-4" />
              افزودن تولیدکننده
            </button>
          ) : (
            <span className="chip border-white/10 bg-white/[0.04] text-white/45">
              نمایش فقط‌خواندنی
            </span>
          )
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'کل تولیدکنندگان', value: stats.total },
          { label: 'تولیدکنندگان فعال', value: stats.active },
          { label: 'سوابق ثبت‌شده', value: stats.records },
        ].map((item) => (
          <div key={item.label} className="panel p-3 sm:flex sm:items-center sm:justify-between sm:p-4">
            <span className="text-[9.5px] leading-4 text-white/40 sm:text-[11px]">{item.label}</span>
            <span className="mt-2 block text-lg font-extrabold text-white sm:mt-0 sm:text-xl">
              {formatNumber(item.value)}
            </span>
          </div>
        ))}
      </div>

      <section className="panel min-w-0 overflow-hidden">
        <div className="panel-header flex-col !items-stretch gap-3 sm:flex-row sm:!items-center">
          <div>
            <h2 className="panel-title">
              <LuTruck className="size-[18px] text-emerald-300" />
              فهرست تولیدکنندگان
            </h2>
            <p className="panel-subtitle">
              {formatNumber(filtered.length)} تولیدکننده در سامانه
            </p>
          </div>
          <div className="relative w-full sm:max-w-[240px]">
            <LuSearch className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی نام یا سمت…"
              className="input py-2 pr-9 text-[12px]"
              aria-label="جستجوی تولیدکننده"
            />
          </div>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((row) => (
              <div key={row} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="table-wrap">
            <table className="data-table min-w-[780px]">
              <thead>
                <tr>
                  <th>تولیدکننده</th>
                  <th>سمت / سهم</th>
                  <th>وضعیت</th>
                  <th>تعداد سوابق</th>
                  <th>ترتیب نمایش</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((producer) => (
                  <tr key={producer.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-[12px] font-bold text-emerald-200">
                          {producer.name.slice(0, 1)}
                        </span>
                        <div>
                          <p className="font-medium text-white/85">{producer.name}</p>
                          <p className="mt-1 text-[9px] text-white/30">
                            شناسه: {formatNumber(producer.id)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="chip border-meat-red/20 bg-meat-red/10 text-red-200">
                        {producer.role}
                      </span>
                    </td>
                    <td>
                      <StatusBadge active={producer.is_active} />
                    </td>
                    <td className="text-white/60">{formatNumber(producer.records_count || 0)}</td>
                    <td className="text-white/45">{formatNumber(producer.sort_order)}</td>
                    <td>
                      {canManage ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(producer)}
                            className="btn-secondary !px-2.5 !py-1.5 text-[10px]"
                          >
                            <LuPencil className="size-3.5" />
                            ویرایش
                          </button>
                          <button
                            type="button"
                            onClick={() => setToggleTarget(producer)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              producer.is_active
                                ? 'border-red-500/20 bg-red-500/[0.08] text-red-300/80 hover:bg-red-500/20'
                                : 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300/80 hover:bg-emerald-500/20'
                            }`}
                            aria-label={producer.is_active ? 'غیرفعال کردن تولیدکننده' : 'فعال کردن تولیدکننده'}
                            title={producer.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                          >
                            {producer.is_active ? (
                              <LuUserX className="size-3.5" />
                            ) : (
                              <LuUserCheck className="size-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={search ? 'تولیدکننده‌ای پیدا نشد' : 'هنوز تولیدکننده‌ای ثبت نشده'}
            description={
              search
                ? 'عبارت جستجو را تغییر دهید.'
                : 'اولین تولیدکننده را به سامانه اضافه کنید.'
            }
            icon={LuUsersRound}
            action={
              !search &&
              canManage && (
                <button type="button" onClick={openCreate} className="btn-primary">
                  <LuPlus className="size-4" />
                  افزودن تولیدکننده
                </button>
              )
            }
          />
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'ویرایش تولیدکننده' : 'افزودن تولیدکننده'}
        subtitle={
          editing
            ? 'نام، سمت و وضعیت تولیدکننده را ویرایش کنید.'
            : 'تولیدکننده جدید را به فهرست فرم ثبت تولید اضافه کنید.'
        }
        icon={editing ? LuPencil : LuUsersRound}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              انصراف
            </button>
            <button type="submit" form="producer-form" className="btn-primary" disabled={saving}>
              {saving ? (
                <LuLoaderCircle className="size-4 animate-spin" />
              ) : (
                <LuUserCheck className="size-4" />
              )}
              {saving ? 'در حال ذخیره…' : 'ذخیره تولیدکننده'}
            </button>
          </>
        }
      >
        <form id="producer-form" onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div>
            <label htmlFor="producer-name" className="field-label">نام تولیدکننده</label>
            <input
              id="producer-name"
              className={`input ${fieldErrors.name ? 'input-error' : ''}`}
              value={form.name}
              onChange={(event) => changeField('name', event.target.value)}
              placeholder="مثلاً مهدی زمانی"
              autoFocus
            />
            {fieldErrors.name && <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="producer-role" className="field-label">سمت / سهم</label>
            <input
              id="producer-role"
              className={`input ${fieldErrors.role ? 'input-error' : ''}`}
              value={form.role}
              onChange={(event) => changeField('role', event.target.value)}
              placeholder="مثلاً مدیر ۶۰ درصد"
            />
            {fieldErrors.role && <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.role}</p>}
          </div>
          <div>
            <label htmlFor="producer-order" className="field-label">ترتیب نمایش</label>
            <input
              id="producer-order"
              type="number"
              min="0"
              className={`input ${fieldErrors.sort_order ? 'input-error' : ''}`}
              value={form.sort_order}
              onChange={(event) => changeField('sort_order', event.target.value)}
            />
            {fieldErrors.sort_order && (
              <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.sort_order}</p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => changeField('is_active', event.target.checked)}
              className="h-4 w-4 accent-[#c91c1c]"
            />
            <span>
              <span className="block text-[12px] text-white/75">تولیدکننده فعال باشد</span>
              <span className="mt-0.5 block text-[10px] text-white/30">
                فقط تولیدکنندگان فعال در فرم ثبت تولید نمایش داده می‌شوند.
              </span>
            </span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => !toggling && setToggleTarget(null)}
        onConfirm={handleToggle}
        loading={toggling}
        title={toggleTarget?.is_active ? 'غیرفعال کردن تولیدکننده' : 'فعال کردن تولیدکننده'}
        description={
          toggleTarget
            ? toggleTarget.is_active
              ? `تولیدکننده «${toggleTarget.name}» از فرم ثبت تولید حذف می‌شود، اما سوابق قبلی حفظ می‌شوند.`
              : `تولیدکننده «${toggleTarget.name}» دوباره در فرم ثبت تولید قابل انتخاب می‌شود.`
            : ''
        }
        confirmLabel={toggleTarget?.is_active ? 'غیرفعال کن' : 'فعال کن'}
        tone={toggleTarget?.is_active ? 'danger' : 'primary'}
      />
    </div>
  )
}
