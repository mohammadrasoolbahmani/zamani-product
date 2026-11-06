import BrandLogo from './BrandLogo'

export default function LogoLoader({ label = 'در حال بارگذاری…' }) {
  return (
    <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="animate-soft-pulse">
        <BrandLogo size="lg" />
      </div>
      <div className="flex items-center gap-2 text-xs text-white/45">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-meat-red" />
        {label}
      </div>
    </div>
  )
}
