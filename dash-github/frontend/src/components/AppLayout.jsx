import { Suspense, useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import ConfirmDialog from './ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { faDigits } from '../utils/format'
import { toJalaliParts, todayISO } from '../utils/date'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const { logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const currentYear = toJalaliParts(todayISO())?.jy

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    const titles = {
      '/dashboard': 'داشبورد مدیریت',
      '/production': 'ثبت آمار تولید',
      '/products': 'مدیریت محصولات',
      '/reports': 'گزارش‌گیری تولید',
      '/producers': 'مدیریت تولیدکنندگان',
      '/operators': 'کاربران سامانه',
      '/settings': 'تنظیمات',
    }
    document.title = `${titles[location.pathname] || 'پنل مدیریت'} | ZAMANI BURGER`
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    setLogoutOpen(false)
    toast.success('با موفقیت از حساب خارج شدید.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-bg min-h-screen">
      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        onRequestLogout={() => setLogoutOpen(true)}
      />

      <div className="flex min-h-screen flex-col lg:pr-[278px]">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          onRequestLogout={() => setLogoutOpen(true)}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 xl:px-8 xl:py-7">
          <div className="mx-auto w-full max-w-[1500px]">
            <Suspense
              fallback={
                <div className="space-y-4 animate-fade-in">
                  <div className="skeleton h-20 w-full rounded-2xl" />
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="skeleton h-40 rounded-2xl" />
                    ))}
                  </div>
                  <div className="skeleton h-72 w-full rounded-2xl" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>

        <footer className="border-t border-white/[0.05] px-4 py-4 sm:px-6 xl:px-8">
          <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-1.5 text-[10px] text-white/25 sm:flex-row">
            <p>ZAMANI BURGER © {faDigits(currentYear || '')} — پنل مدیریت تولید</p>
            <p>طراحی‌شده برای پایش دقیق خط تولید</p>
          </div>
        </footer>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
        title="خروج از حساب کاربری"
        description="آیا می‌خواهید از پنل مدیریت خارج شوید؟ برای ورود مجدد به نام کاربری و رمز عبور نیاز دارید."
        confirmLabel="خروج از سیستم"
      />
    </div>
  )
}
