import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  LuArrowLeft,
  LuChartNoAxesCombined,
  LuEye,
  LuEyeOff,
  LuFactory,
  LuLoaderCircle,
  LuLockKeyhole,
  LuLogIn,
  LuShieldCheck,
  LuUserRound,
} from 'react-icons/lu'
import BrandLogo from '../components/BrandLogo'
import LogoLoader from '../components/LogoLoader'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../api/errors'
import { faDigits } from '../utils/format'
import { toJalaliParts, todayISO } from '../utils/date'

export default function Login() {
  const { user, initializing, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const usernameRef = useRef(null)
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'ورود | ZAMANI BURGER'
    if (!initializing) usernameRef.current?.focus()
  }, [initializing])

  if (initializing) return <LogoLoader label="در حال آماده‌سازی پنل…" />
  if (user) return <Navigate to="/dashboard" replace />

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.username.trim() || !form.password) {
      setError('نام کاربری و رمز عبور را وارد کنید.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const loggedIn = await login(form.username.trim(), form.password)
      toast.success(`خوش آمدید، ${loggedIn.display_name || loggedIn.username}`)
      const from = location.state?.from
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setError('نام کاربری یا رمز عبور نادرست است.')
      } else if (requestError.response?.status === 403) {
        setError('دسترسی این حساب غیرفعال است. با مدیر سیستم تماس بگیرید.')
      } else {
        setError(getApiErrorMessage(requestError, 'ورود ناموفق بود. دوباره تلاش کنید.'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#111111] lg:grid lg:grid-cols-[minmax(460px,0.88fr)_1.12fr]">
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#121212]">
        <div
          className="pointer-events-none absolute -right-32 -top-40 h-[440px] w-[440px] rounded-full bg-meat-red/15 blur-[100px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-44 -left-24 h-[380px] w-[380px] rounded-full bg-red-950/30 blur-[100px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-24 top-24 h-px w-[420px] rotate-[-24deg] bg-gradient-to-r from-transparent via-meat-red/35 to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-14 top-40 h-px w-[320px] rotate-[-24deg] bg-gradient-to-r from-transparent via-meat-red/15 to-transparent"
          aria-hidden="true"
        />

        <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-8">
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            <span className="h-1.5 w-1.5 rounded-full bg-meat-red" />
            پنل مدیریت تولید
          </div>
          <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9px] text-white/25">
            نسخه {faDigits('1.0')}
          </span>
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-8 sm:px-8">
          <div className="w-full max-w-[414px] rounded-2xl border border-white/[0.08] bg-[#181818]/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur-md sm:p-8">
            <div className="flex justify-center">
              <BrandLogo stacked size="lg" />
            </div>

            <div className="mt-6 text-center">
              <h1 className="text-[22px] font-extrabold tracking-tight text-white">
                ورود به پنل مدیریت
              </h1>
              <p className="mt-2 text-[12px] leading-6 text-white/40">
                لطفاً نام کاربری و رمز عبور خود را وارد کنید
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
              <div>
                <label htmlFor="username" className="field-label">
                  نام کاربری
                </label>
                <div className="relative">
                  <LuUserRound className="input-icon size-[18px]" />
                  <input
                    ref={usernameRef}
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={form.username}
                    onChange={handleChange}
                    className="input py-3 pr-11 text-[13px]"
                    placeholder="نام کاربری خود را وارد کنید"
                    aria-invalid={Boolean(error)}
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="field-label">
                  رمز عبور
                </label>
                <div className="relative">
                  <LuLockKeyhole className="input-icon size-[18px]" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={handleChange}
                    className="input py-3 pl-11 pr-11 text-[13px]"
                    placeholder="رمز عبور خود را وارد کنید"
                    aria-invalid={Boolean(error)}
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 transition hover:text-white/70"
                    aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                  >
                    {showPassword ? <LuEyeOff className="size-[17px]" /> : <LuEye className="size-[17px]" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5 text-[11px] leading-5 text-red-200"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[13px]">
                {loading ? (
                  <LuLoaderCircle className="size-[18px] animate-spin" />
                ) : (
                  <LuLogIn className="size-[18px]" />
                )}
                {loading ? 'در حال ورود…' : 'ورود'}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-white/30">
              <LuShieldCheck className="size-3.5" />
              فقط برای مدیران مجاز
            </div>
          </div>
        </div>

        <footer className="relative z-10 flex items-center justify-between px-6 pb-5 text-[9px] text-white/20 sm:px-8">
          <span>ZAMANI BURGER © {faDigits(toJalaliParts(todayISO())?.jy || '')}</span>
          <span>Production Management System</span>
        </footer>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden lg:block">
        <img
          src="/images/login-hero.jpg"
          alt="همبرگر و استیک تازه روی تخته چوبی"
          className="absolute inset-0 h-full w-full object-cover object-[45%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#121212] via-[#121212]/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#121212] to-transparent" />
        <div
          className="absolute -left-20 top-24 h-px w-[640px] rotate-[-22deg] bg-gradient-to-r from-transparent via-meat-red/60 to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute -left-24 top-32 h-px w-[640px] rotate-[-22deg] bg-gradient-to-r from-transparent via-meat-red/20 to-transparent"
          aria-hidden="true"
        />

        <div className="absolute right-10 top-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3.5 py-1.5 text-[10px] text-white/70 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          کیفیت در هر قطعه
        </div>

        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <div className="max-w-lg">
            <p className="mb-3 flex items-center gap-2 text-[10px] font-medium tracking-[0.22em] text-red-200/70">
              <span className="h-px w-7 bg-meat-red" />
              ZAMANI BURGER
            </p>
            <h2 className="text-balance text-3xl font-extrabold leading-[1.45] text-white xl:text-[38px]">
              از خط تولید تا سفره،
              <br />
              <span className="text-red-300">کیفیت را مدیریت کنید.</span>
            </h2>
            <p className="mt-4 max-w-md text-[12px] leading-7 text-white/50">
              ثبت دقیق تولید، مدیریت گاری‌ها و گزارش‌های شفاف؛ همه در یک پنل یکپارچه برای
              کارخانه فرآورده‌های گوشتی.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 backdrop-blur-md">
                <LuFactory className="size-4 text-red-300" />
                <span className="text-[11px] text-white/65">کنترل یکپارچه خط تولید</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 backdrop-blur-md">
                <LuChartNoAxesCombined className="size-4 text-red-300" />
                <span className="text-[11px] text-white/65">گزارش‌های لحظه‌ای</span>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-[10px] text-white/25">
              <LuArrowLeft className="size-3.5" />
              سامانه اختصاصی مدیران ZAMANI BURGER
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
