import { LuBeef, LuSandwich } from 'react-icons/lu'

const SIZES = {
  sm: 'h-10 w-10 rounded-xl',
  md: 'h-12 w-12 rounded-2xl',
  lg: 'h-16 w-16 rounded-[20px]',
}

export default function BrandLogo({
  size = 'md',
  compact = false,
  stacked = false,
  className = '',
}) {
  const textSize =
    size === 'lg' ? 'text-[25px] sm:text-[28px]' : size === 'sm' ? 'text-[15px]' : 'text-[19px]'

  return (
    <div
      className={`flex ${stacked ? 'flex-col items-center gap-2.5' : 'items-center gap-3'} ${className}`}
      aria-label="ZAMANI BURGER"
    >
      <div className={`relative shrink-0 ${SIZES[size]}`}>
        <div className="absolute inset-0 rounded-[inherit] bg-meat-red/30 blur-lg" aria-hidden="true" />
        <img
          src="/favicon.svg"
          alt=""
          className="relative h-full w-full rounded-[inherit] ring-1 ring-white/15"
        />
      </div>
      {!compact && (
        <div dir="ltr" className={`min-w-0 ${stacked ? 'text-center' : 'text-left'}`}>
          <div className={`${textSize} whitespace-nowrap font-extrabold leading-none tracking-[-0.035em]`}>
            <span className="text-white">ZAMANI</span>{' '}
            <span className="text-[#e63535]">BURGER</span>
          </div>
          <div className="mt-1.5 whitespace-nowrap text-[8px] font-medium uppercase tracking-[0.2em] text-white/40">
            Production Dashboard
          </div>
        </div>
      )}
    </div>
  )
}

export function ProductAvatar({ name = '', image = null, size = 'md', className = '' }) {
  const dimensions =
    size === 'sm'
      ? 'h-9 w-9 rounded-lg'
      : size === 'lg'
        ? 'h-12 w-12 rounded-xl'
        : 'h-10 w-10 rounded-xl'
  const iconSize = size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5'
  const isBurger = name.includes('برگر')
  const Icon = isBurger ? LuSandwich : LuBeef

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-amber-200/80 ${dimensions} ${className}`}
      aria-hidden="true"
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon className={iconSize} />
      )}
    </span>
  )
}
