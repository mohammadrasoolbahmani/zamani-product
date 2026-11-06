import { useState } from 'react'
import {
  LuAtSign,
  LuCalendarDays,
  LuClock3,
  LuFactory,
  LuLoaderCircle,
  LuLockKeyhole,
  LuMail,
  LuSave,
  LuShieldCheck,
  LuUserRound,
} from 'react-icons/lu'
import api from '../api/client'
import { getApiErrorMessage, getFieldErrors } from '../api/errors'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/PageHeader'
import { formatJalali, formatTime } from '../utils/date'
import { initials } from '../utils/format'

export default function Settings() {
  const { user, updateUser } = useAuth()
  const toast = useToast()

  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
  })
  const [profileErrors, setProfileErrors] = useState({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [password, setPassword] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [savingPassword, setSavingPassword] = useState(false)

  const handleProfile = async (event) => {
    event.preventDefault()
    const errors = {}
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      errors.email = 'ایمیل معتبر نیست.'
    }
    setProfileErrors(errors)
    if (Object.keys(errors).length) return

    setSavingProfile(true)
    try {
      const { data } = await api.patch('/me/', profile)
      updateUser(data)
      setProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
      })
      toast.success('اطلاعات حساب به‌روزرسانی شد.')
    } catch (requestError) {
      setProfileErrors(getFieldErrors(requestError))
      toast.error(getApiErrorMessage(requestError, 'ذخیره اطلاعات حساب ناموفق بود.'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePassword = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!password.old_password) errors.old_password = 'رمز عبور فعلی را وارد کنید.'
    if (password.new_password.length < 8) errors.new_password = 'رمز جدید باید حداقل ۸ کاراکتر باشد.'
    if (password.new_password !== password.confirm_password) {
      errors.confirm_password = 'تکرار رمز عبور با رمز جدید یکسان نیست.'
    }
    if (password.new_password && password.new_password === password.old_password) {
      errors.new_password = 'رمز جدید باید با رمز فعلی متفاوت باشد.'
    }
    setPasswordErrors(errors)
    if (Object.keys(errors).length) return

    setSavingPassword(true)
    try {
      await api.post('/me/password/', {
        old_password: password.old_password,
        new_password: password.new_password,
      })
      setPassword({ old_password: '', new_password: '', confirm_password: '' })
      toast.success('رمز عبور با موفقیت تغییر کرد.')
    } catch (requestError) {
      setPasswordErrors(getFieldErrors(requestError))
      toast.error(getApiErrorMessage(requestError, 'تغییر رمز عبور ناموفق بود.'))
    } finally {
      setSavingPassword(false)
    }
  }

  const setPasswordField = (name, value) => {
    setPassword((current) => ({ ...current, [name]: value }))
    setPasswordErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="حساب کاربری"
        title="تنظیمات"
        description="اطلاعات حساب، امنیت ورود و مشخصات عملیاتی سامانه را مدیریت کنید."
        icon={LuUserRound}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <LuUserRound className="size-[18px] text-meat-red" />
                  اطلاعات حساب
                </h2>
                <p className="panel-subtitle">نام نمایشی و راه ارتباطی حساب شما</p>
              </div>
            </div>
            <form onSubmit={handleProfile} className="p-5 sm:p-6" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="settings-first" className="field-label">نام</label>
                  <input
                    id="settings-first"
                    className={`input ${profileErrors.first_name ? 'input-error' : ''}`}
                    value={profile.first_name}
                    onChange={(event) => setProfile((current) => ({ ...current, first_name: event.target.value }))}
                    placeholder="نام"
                  />
                  {profileErrors.first_name && (
                    <p className="mt-1.5 text-[10px] text-red-300">{profileErrors.first_name}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="settings-last" className="field-label">نام خانوادگی</label>
                  <input
                    id="settings-last"
                    className={`input ${profileErrors.last_name ? 'input-error' : ''}`}
                    value={profile.last_name}
                    onChange={(event) => setProfile((current) => ({ ...current, last_name: event.target.value }))}
                    placeholder="نام خانوادگی"
                  />
                  {profileErrors.last_name && (
                    <p className="mt-1.5 text-[10px] text-red-300">{profileErrors.last_name}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="settings-email" className="field-label">
                    <LuMail className="size-3.5" />
                    ایمیل
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    dir="ltr"
                    className={`input text-right ${profileErrors.email ? 'input-error' : ''}`}
                    value={profile.email}
                    onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                  {profileErrors.email && (
                    <p className="mt-1.5 text-[10px] text-red-300">{profileErrors.email}</p>
                  )}
                </div>
              </div>
              <div className="mt-5 flex justify-end border-t border-white/[0.06] pt-4">
                <button type="submit" className="btn-primary" disabled={savingProfile}>
                  {savingProfile ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuSave className="size-4" />}
                  {savingProfile ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <LuLockKeyhole className="size-[18px] text-orange-300" />
                  تغییر رمز عبور
                </h2>
                <p className="panel-subtitle">برای امنیت بیشتر، رمز عبور دوره‌ای را تغییر دهید</p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.07] px-2 py-1 text-[9px] text-emerald-300 sm:flex">
                <LuShieldCheck className="size-3.5" />
                اتصال امن
              </span>
            </div>
            <form onSubmit={handlePassword} className="p-5 sm:p-6" noValidate>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="old-password" className="field-label">رمز عبور فعلی</label>
                  <input
                    id="old-password"
                    type="password"
                    className={`input text-right ${passwordErrors.old_password ? 'input-error' : ''}`}
                    value={password.old_password}
                    onChange={(event) => setPasswordField('old_password', event.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                  />
                  {passwordErrors.old_password && (
                    <p className="mt-1.5 text-[10px] text-red-300">{passwordErrors.old_password}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="new-password" className="field-label">رمز عبور جدید</label>
                  <input
                    id="new-password"
                    type="password"
                    className={`input text-right ${passwordErrors.new_password ? 'input-error' : ''}`}
                    value={password.new_password}
                    onChange={(event) => setPasswordField('new_password', event.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                  />
                  {passwordErrors.new_password && (
                    <p className="mt-1.5 text-[10px] text-red-300">{passwordErrors.new_password}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="confirm-password" className="field-label">تکرار رمز جدید</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className={`input text-right ${passwordErrors.confirm_password ? 'input-error' : ''}`}
                    value={password.confirm_password}
                    onChange={(event) => setPasswordField('confirm_password', event.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                  />
                  {passwordErrors.confirm_password && (
                    <p className="mt-1.5 text-[10px] text-red-300">{passwordErrors.confirm_password}</p>
                  )}
                </div>
              </div>
              <div className="mt-5 flex flex-col justify-between gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center">
                <p className="text-[10px] leading-5 text-white/30">
                  رمز عبور باید حداقل ۸ کاراکتر و غیرقابل‌حدس باشد.
                </p>
                <button type="submit" className="btn-secondary" disabled={savingPassword}>
                  {savingPassword ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuLockKeyhole className="size-4" />}
                  {savingPassword ? 'در حال تغییر…' : 'تغییر رمز عبور'}
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="h-24 bg-[radial-gradient(circle_at_30%_20%,rgba(201,28,28,0.35),transparent_55%),linear-gradient(135deg,#242424,#171717)]" />
            <div className="-mt-10 px-5 pb-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-meat-panel bg-gradient-to-br from-[#3a3a3a] to-[#1c1c1c] text-xl font-extrabold text-white shadow-xl">
                {initials(user?.display_name)}
              </div>
              <h2 className="mt-3 text-lg font-extrabold text-white">{user?.display_name}</h2>
              <p className="mt-1 text-[11px] text-white/35" dir="ltr">
                @{user?.username}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip border-meat-red/20 bg-meat-red/10 text-red-200">
                  <LuShieldCheck className="size-3" />
                  {user?.role}
                </span>
                <span className="chip border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  حساب فعال
                </span>
              </div>
            </div>
            <div className="border-t border-white/[0.06] px-5 py-4">
              <dl className="space-y-3 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-white/35">
                    <LuAtSign className="size-3.5" />
                    نام کاربری
                  </dt>
                  <dd className="text-white/65" dir="ltr">@{user?.username}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-white/35">
                    <LuCalendarDays className="size-3.5" />
                    تاریخ عضویت
                  </dt>
                  <dd className="text-white/65">
                    {user?.date_joined ? formatJalali(user.date_joined.slice(0, 10)) : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-white/35">
                    <LuClock3 className="size-3.5" />
                    آخرین ورود
                  </dt>
                  <dd className="text-white/65">
                    {user?.last_login
                      ? `${formatJalali(user.last_login.slice(0, 10))} — ${formatTime(user.last_login)}`
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <LuFactory className="size-[18px] text-sky-300" />
                  مشخصات عملیاتی
                </h2>
                <p className="panel-subtitle">پیکربندی فعال سامانه تولید</p>
              </div>
            </div>
            <div className="space-y-3 p-5 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/35">برند سامانه</span>
                <span className="font-semibold text-white/75" dir="ltr">ZAMANI BURGER</span>
              </div>
              <div className="divider" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/35">منطقه زمانی</span>
                <span className="text-white/65" dir="ltr">Asia/Tehran</span>
              </div>
              <div className="divider" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/35">تقویم</span>
                <span className="text-white/65">شمسی (جلالی)</span>
              </div>
              <div className="divider" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/35">وضعیت API</span>
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  متصل
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
