import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LuArrowRight, LuHouse } from 'react-icons/lu'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const { user } = useAuth()
  const destination = user ? '/dashboard' : '/login'

  useEffect(() => {
    document.title = 'صفحه پیدا نشد | ZAMANI BURGER'
  }, [])

  return (
    <div className="app-bg relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-meat-red/10 blur-[100px]" />
      <div className="relative">
        <BrandLogo stacked size="lg" className="mb-10" />
        <p className="text-[92px] font-extrabold leading-none tracking-tighter text-white/[0.07] sm:text-[130px]">
          ۴۰۴
        </p>
        <h1 className="-mt-4 text-2xl font-extrabold text-white sm:text-3xl">این صفحه پیدا نشد</h1>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-7 text-meat-muted">
          آدرسی که وارد کرده‌اید وجود ندارد یا جابه‌جا شده است. می‌توانید به صفحه اصلی بازگردید.
        </p>
        <Link to={destination} className="btn-primary mt-7">
          {user ? <LuHouse className="size-4" /> : <LuArrowRight className="size-4" />}
          {user ? 'بازگشت به داشبورد' : 'ورود به سامانه'}
        </Link>
      </div>
      <p className="absolute bottom-6 text-[10px] text-white/20">ZAMANI BURGER · Production Dashboard</p>
    </div>
  )
}
