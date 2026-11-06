import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LuCalendarDays,
  LuChevronDown,
  LuLogOut,
  LuMenu,
  LuSettings,
} from 'react-icons/lu'
import BrandLogo from './BrandLogo'
import { useAuth } from '../context/AuthContext'
import { formatJalali, todayISO } from '../utils/date'
import { initials } from '../utils/format'

export default function Header({ onOpenSidebar, onRequestLogout }) {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const displayName = user?.display_name || user?.full_name || user?.username || 'کاربر'

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.065] bg-meat-dark/75 backdrop-blur-xl">
      <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:text-white lg:hidden"
            aria-label="باز کردن منو"
          >
            <LuMenu className="size-5" />
          </button>
          <div className="lg:hidden">
            <BrandLogo compact size="sm" />
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="flex items-center gap-3 rounded-xl py-1 pl-2 pr-1 text-right transition hover:bg-white/[0.04]"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[#3a3a3a] to-[#1c1c1c] text-xs font-bold text-white/85 shadow-inner">
                {initials(displayName)}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block truncate text-[13px] font-semibold text-white">
                  {displayName}
                </span>
                <span className="mt-0.5 block text-[10px] text-white/35">{user?.role || 'کاربر'}</span>
              </span>
              <LuChevronDown
                className={`mt-0.5 hidden size-3.5 text-white/30 transition sm:block ${
                  menuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+10px)] w-52 overflow-hidden rounded-xl border border-white/10 bg-[#1d1d1d] p-1.5 shadow-2xl animate-fade-up"
              >
                <div className="border-b border-white/[0.07] px-3 py-2.5">
                  <p className="text-xs font-semibold text-white">{displayName}</p>
                  <p className="mt-1 text-[10px] text-white/35" dir="ltr">
                    @{user?.username}
                  </p>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/65 transition hover:bg-white/[0.06] hover:text-white"
                  role="menuitem"
                >
                  <LuSettings className="size-4" />
                  تنظیمات حساب
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onRequestLogout()
                  }}
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-red-300/80 transition hover:bg-red-500/10 hover:text-red-200"
                >
                  <LuLogOut className="size-4" />
                  خروج از سیستم
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 lg:flex">
            <LuCalendarDays className="size-4 text-white/35" />
            <span className="text-[11px] text-white/40">امروز:</span>
            <span className="text-[12px] font-medium text-white/75">
              {formatJalali(todayISO(), { withWeekday: true })}
            </span>
          </div>
          <div className="hidden h-6 w-px bg-white/10 sm:block" />
          <span className="hidden items-center gap-1.5 text-[10px] text-white/35 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            سیستم در دسترس
          </span>
        </div>
      </div>
    </header>
  )
}
