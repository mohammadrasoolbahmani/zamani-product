import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LuBeef,
  LuChartNoAxesCombined,
  LuClipboardPlus,
  LuLayoutDashboard,
  LuLogOut,
  LuSettings,
  LuShieldCheck,
  LuUsersRound,
  LuX,
} from 'react-icons/lu'
import BrandLogo from './BrandLogo'
import { faDigits } from '../utils/format'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'داشبورد', icon: LuLayoutDashboard },
  { to: '/production', label: 'ثبت آمار تولید', icon: LuClipboardPlus },
  { to: '/producers', label: 'مدیریت تولیدکنندگان', icon: LuUsersRound },
  { to: '/products', label: 'مدیریت محصولات', icon: LuBeef },
  { to: '/reports', label: 'گزارش‌گیری', icon: LuChartNoAxesCombined },
  { to: '/operators', label: 'کاربران سامانه', icon: LuShieldCheck },
  { to: '/settings', label: 'تنظیمات', icon: LuSettings },
]

export default function Sidebar({ open, onClose, onRequestLogout }) {
  const location = useLocation()

  useEffect(() => {
    onClose?.()
  }, [location.pathname, onClose])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  return (
    <>
      <button
        type="button"
        aria-label="بستن منو"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/65 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        tabIndex={open ? 0 : -1}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[278px] flex-col border-l border-white/[0.07] bg-[#171717]/98 shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="relative overflow-hidden border-b border-white/[0.06] px-6 pb-6 pt-6">
          <div
            className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-meat-red/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between">
            <NavLink to="/dashboard" aria-label="صفحه اصلی ZAMANI BURGER">
              <BrandLogo />
            </NavLink>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-white lg:hidden"
              aria-label="بستن منو"
            >
              <LuX className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 scroll-thin">
          <p className="mb-2 px-3 text-[10px] font-medium tracking-wider text-white/25">
            فضای کاری
          </p>
          <nav className="space-y-1.5" aria-label="منوی اصلی">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium transition duration-200 ${
                      isActive
                        ? 'bg-red-sheen text-white shadow-red-glow'
                        : 'text-white/55 hover:bg-white/[0.045] hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`size-[18px] shrink-0 ${
                          isActive ? 'text-white' : 'text-white/40 group-hover:text-white/75'
                        }`}
                      />
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="mr-auto h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden="true" />
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-white/45">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                خط تولید فعال
              </span>
              <span className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
                آنلاین
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-white/[0.06] pt-3">
              <div>
                <p className="text-[10px] text-white/35">آخرین به‌روزرسانی</p>
                <p className="mt-0.5 text-sm font-bold text-white">آمار تولید</p>
              </div>
              <p className="text-[10px] text-white/40" dir="rtl">
                ZAMANI BURGER
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <button
            type="button"
            onClick={onRequestLogout}
            className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium text-white/50 transition hover:bg-red-500/[0.08] hover:text-red-300"
          >
            <LuLogOut className="size-[18px] text-white/35 transition group-hover:text-red-300" />
            خروج از سیستم
          </button>
          <p className="mt-2 px-3.5 text-[9px] text-white/20">
            ZAMANI BURGER · نسخه {faDigits('1.0.0')}
          </p>
        </div>
      </aside>
    </>
  )
}
