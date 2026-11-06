import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LuKeyRound,
  LuLoaderCircle,
  LuPencil,
  LuPlus,
  LuSearch,
  LuShieldAlert,
  LuShieldCheck,
  LuUserCheck,
  LuUserPlus,
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
import { formatJalali, formatTime } from '../utils/date'
import { formatNumber, initials } from '../utils/format'

const emptyUserForm = { first_name: '', last_name: '', username: '', email: '', password: '', is_active: true }

function Avatar({ name, staff = false }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
        staff
          ? 'border-meat-red/30 bg-meat-red/10 text-red-200'
          : 'border-white/10 bg-white/[0.05] text-white/65'
      }`}
    >
      {initials(name)}
    </span>
  )
}

export default function Operators() {
  const { user } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(emptyUserForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [toggleTarget, setToggleTarget] = useState(null)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/users/?page_size=100')
      setUsers(data.results ?? data)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'دریافت فهرست کاربران ناموفق بود.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.is_staff) load()
    else setLoading(false)
  }, [user?.is_staff, load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((item) =>
      [item.display_name, item.username, item.email, item.first_name, item.last_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [users, search])

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((item) => item.is_active).length,
      admins: users.filter((item) => item.is_staff).length,
    }),
    [users],
  )

  if (!user?.is_staff) {
    return (
      <div className="animate-fade-up">
        <PageHeader
          eyebrow="مدیریت دسترسی"
          title="کاربران سامانه"
          description="مدیریت حساب‌های کاربری و دسترسی به سامانه."
          icon={LuUsersRound}
        />
        <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <LuShieldAlert className="size-7" />
          </div>
          <h2 className="text-lg font-bold text-white">دسترسی محدود</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-meat-muted">
            این بخش فقط برای مدیران سیستم قابل دسترسی است. برای تغییر کاربران با مدیر ارشد
            تماس بگیرید.
          </p>
        </div>
      </div>
    )
  }

  const openCreate = () => {
    setEditingUser(null)
    setForm(emptyUserForm)
    setFieldErrors({})
    setFormOpen(true)
  }

  const openEdit = (target) => {
    setEditingUser(target)
    setForm({
      first_name: target.first_name || '',
      last_name: target.last_name || '',
      username: target.username,
      email: target.email || '',
      password: '',
      is_active: target.is_active,
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
    if (!form.first_name.trim()) errors.first_name = 'نام را وارد کنید.'
    if (!form.last_name.trim()) errors.last_name = 'نام خانوادگی را وارد کنید.'
    if (!editingUser && !form.username.trim()) errors.username = 'نام کاربری را وارد کنید.'
    if (!editingUser && form.password.length < 8) {
      errors.password = 'رمز عبور باید حداقل ۸ کاراکتر باشد.'
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'ایمیل معتبر نیست.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setSaving(true)
    try {
      if (editingUser) {
        const { data } = await api.patch(`/users/${editingUser.id}/`, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          is_active: form.is_active,
        })
        setUsers((current) => current.map((item) => (item.id === data.id ? data : item)))
        toast.success('اطلاعات کاربر به‌روزرسانی شد.')
      } else {
        const { data } = await api.post('/users/', {
          first_name: form.first_name,
          last_name: form.last_name,
          username: form.username,
          email: form.email,
          password: form.password,
          is_active: form.is_active,
        })
        setUsers((current) => [...current, data].sort((a, b) => a.username.localeCompare(b.username)))
        toast.success(`کاربر «${data.display_name}» ایجاد شد.`)
      }
      setFormOpen(false)
    } catch (requestError) {
      setFieldErrors(getFieldErrors(requestError))
      toast.error(getApiErrorMessage(requestError, 'ذخیره کاربر ناموفق بود.'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const { data } = await api.patch(`/users/${toggleTarget.id}/`, {
        is_active: !toggleTarget.is_active,
      })
      setUsers((current) => current.map((item) => (item.id === data.id ? data : item)))
      toast.success(data.is_active ? 'حساب کاربر فعال شد.' : 'حساب کاربر غیرفعال شد.')
      setToggleTarget(null)
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'تغییر وضعیت کاربر ناموفق بود.'))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="مدیریت دسترسی"
        title="کاربران سامانه"
        description="حساب‌های کاربری را ایجاد کنید، اطلاعات آن‌ها را ویرایش و وضعیت دسترسی را مدیریت کنید."
        icon={LuUsersRound}
        actions={
          <button type="button" onClick={openCreate} className="btn-primary">
            <LuUserPlus className="size-4" />
            افزودن تولیدکننده
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'کل کاربران', value: stats.total, icon: LuUsersRound, tone: 'text-sky-300 bg-sky-400/10 border-sky-400/15' },
          { label: 'حساب‌های فعال', value: stats.active, icon: LuUserCheck, tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/15' },
          { label: 'مدیران سیستم', value: stats.admins, icon: LuShieldCheck, tone: 'text-red-300 bg-red-400/10 border-red-400/15' },
        ].map((item) => (
          <div key={item.label} className="panel p-3 sm:flex sm:items-center sm:gap-3 sm:p-4">
            <span className={`icon-box h-8 w-8 border sm:h-10 sm:w-10 ${item.tone}`}>
              <item.icon className="size-4 sm:size-5" />
            </span>
            <div className="mt-2 sm:mt-0">
              <p className="text-[9px] text-white/35 sm:text-[10px]">{item.label}</p>
              <p className="mt-0.5 text-base font-extrabold text-white sm:text-lg">{formatNumber(item.value)}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="panel min-w-0 overflow-hidden">
        <div className="panel-header flex-col !items-stretch gap-3 sm:flex-row sm:!items-center">
          <div>
            <h2 className="panel-title">
              <LuUsersRound className="size-[18px] text-meat-red" />
              کاربران سامانه
            </h2>
            <p className="panel-subtitle">{formatNumber(filtered.length)} کاربر نمایش داده می‌شود</p>
          </div>
          <div className="relative w-full max-w-[230px]">
            <LuSearch className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی کاربر…"
              className="input py-2 pr-9 text-[12px]"
              aria-label="جستجوی کاربر"
            />
          </div>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="table-wrap">
            <table className="data-table min-w-[820px]">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>نقش</th>
                  <th>وضعیت</th>
                  <th>آخرین ورود</th>
                  <th>تاریخ عضویت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={item.display_name} staff={item.is_staff} />
                        <div>
                          <p className="font-medium text-white/90">
                            {item.display_name}
                            {item.id === user.id && (
                              <span className="mr-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-white/40">
                                شما
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-[10px] text-white/30" dir="ltr">
                            @{item.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${item.is_staff ? 'border-meat-red/20 bg-meat-red/10 text-red-200' : 'border-white/10 bg-white/[0.04] text-white/55'}`}>
                        {item.role}
                      </span>
                    </td>
                    <td>
                      <StatusBadge active={item.is_active} activeLabel="فعال" inactiveLabel="غیرفعال" />
                    </td>
                    <td className="text-white/50">
                      {item.last_login ? (
                        <span>
                          {formatJalali(item.last_login.slice(0, 10))}
                          <span className="mr-1 text-[9px] text-white/25">{formatTime(item.last_login)}</span>
                        </span>
                      ) : (
                        <span className="text-white/25">بدون ورود</span>
                      )}
                    </td>
                    <td className="text-white/45">{formatJalali(item.date_joined.slice(0, 10))}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="btn-secondary !px-2.5 !py-1.5 text-[10px]"
                        >
                          <LuPencil className="size-3.5" />
                          ویرایش
                        </button>
                        {item.id !== user.id && (
                          <button
                            type="button"
                            onClick={() => setToggleTarget(item)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              item.is_active
                                ? 'border-red-500/20 bg-red-500/[0.08] text-red-300/80 hover:bg-red-500/20'
                                : 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300/80 hover:bg-emerald-500/20'
                            }`}
                            aria-label={item.is_active ? 'غیرفعال کردن کاربر' : 'فعال کردن کاربر'}
                            title={item.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                          >
                            {item.is_active ? <LuUserX className="size-3.5" /> : <LuUserCheck className="size-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={search ? 'کاربری پیدا نشد' : 'هنوز کاربری ثبت نشده'}
            description={search ? 'عبارت جستجو را تغییر دهید.' : 'اولین کاربر را به سامانه اضافه کنید.'}
            icon={LuUsersRound}
            action={
              !search && (
                <button type="button" onClick={openCreate} className="btn-primary">
                  <LuPlus className="size-4" />
                  افزودن کاربر
                </button>
              )
            }
          />
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingUser ? 'ویرایش کاربر' : 'افزودن کاربر'}
        subtitle={editingUser ? 'اطلاعات حساب کاربری را به‌روزرسانی کنید.' : 'حسابی برای ثبت آمار تولید ایجاد کنید.'}
        icon={editingUser ? LuPencil : LuUserPlus}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              انصراف
            </button>
            <button type="submit" form="operator-form" className="btn-primary" disabled={saving}>
              {saving ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuUserCheck className="size-4" />}
              {saving ? 'در حال ذخیره…' : 'ذخیره کاربر'}
            </button>
          </>
        }
      >
        <form id="operator-form" onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div>
            <label htmlFor="operator-first" className="field-label">نام</label>
            <input
              id="operator-first"
              className={`input ${fieldErrors.first_name ? 'input-error' : ''}`}
              value={form.first_name}
              onChange={(event) => changeField('first_name', event.target.value)}
              placeholder="نام"
            />
            {fieldErrors.first_name && <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.first_name}</p>}
          </div>
          <div>
            <label htmlFor="operator-last" className="field-label">نام خانوادگی</label>
            <input
              id="operator-last"
              className={`input ${fieldErrors.last_name ? 'input-error' : ''}`}
              value={form.last_name}
              onChange={(event) => changeField('last_name', event.target.value)}
              placeholder="نام خانوادگی"
            />
            {fieldErrors.last_name && <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.last_name}</p>}
          </div>
          <div>
            <label htmlFor="operator-username" className="field-label">نام کاربری</label>
            <input
              id="operator-username"
              className={`input text-right ${fieldErrors.username ? 'input-error' : ''}`}
              value={form.username}
              onChange={(event) => changeField('username', event.target.value)}
              placeholder="username"
              dir="ltr"
              disabled={Boolean(editingUser)}
              autoComplete="off"
            />
            {fieldErrors.username && <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.username}</p>}
          </div>
          <div>
            <label htmlFor="operator-email" className="field-label">ایمیل <span className="text-[9px] text-white/25">(اختیاری)</span></label>
            <input
              id="operator-email"
              type="email"
              className={`input text-right ${fieldErrors.email ? 'input-error' : ''}`}
              value={form.email}
              onChange={(event) => changeField('email', event.target.value)}
              placeholder="name@example.com"
              dir="ltr"
            />
            {fieldErrors.email && <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.email}</p>}
          </div>
          {!editingUser && (
            <div className="sm:col-span-2">
              <label htmlFor="operator-password" className="field-label">رمز عبور</label>
              <div className="relative">
                <LuKeyRound className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                <input
                  id="operator-password"
                  type="password"
                  className={`input pr-10 text-right ${fieldErrors.password ? 'input-error' : ''}`}
                  value={form.password}
                  onChange={(event) => changeField('password', event.target.value)}
                  placeholder="حداقل ۸ کاراکتر"
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
              {fieldErrors.password ? (
                <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.password}</p>
              ) : (
                <p className="mt-1.5 text-[10px] text-white/25">رمز عبور فقط در زمان ایجاد قابل تعیین است.</p>
              )}
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => changeField('is_active', event.target.checked)}
              className="h-4 w-4 accent-[#c91c1c] disabled:cursor-not-allowed"
              disabled={Boolean(editingUser && (editingUser.id === user.id || editingUser.is_superuser))}
            />
            <span>
              <span className="block text-[12px] text-white/75">حساب کاربری فعال باشد</span>
              <span className="mt-0.5 block text-[10px] text-white/30">
                {editingUser && (editingUser.id === user.id || editingUser.is_superuser)
                  ? 'حساب مدیر ارشد یا حساب جاری از این مسیر غیرفعال نمی‌شود.'
                  : 'کاربران غیرفعال نمی‌توانند وارد سامانه شوند.'}
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
        title={toggleTarget?.is_active ? 'غیرفعال کردن حساب' : 'فعال کردن حساب'}
        description={
          toggleTarget
            ? toggleTarget.is_active
              ? `با غیرفعال شدن «${toggleTarget.display_name}»، این کاربر دیگر نمی‌تواند وارد سامانه شود.`
              : `حساب «${toggleTarget.display_name}» دوباره فعال می‌شود و امکان ورود خواهد داشت.`
            : ''
        }
        confirmLabel={toggleTarget?.is_active ? 'غیرفعال کن' : 'فعال کن'}
        tone={toggleTarget?.is_active ? 'danger' : 'primary'}
      />
    </div>
  )
}
