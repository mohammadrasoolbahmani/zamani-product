import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { LuCircleCheck, LuCircleX, LuInfo, LuX } from 'react-icons/lu'

const ToastContext = createContext(null)

const TONE = {
  success: {
    icon: LuCircleCheck,
    iconClass: 'text-emerald-400',
    bar: 'bg-emerald-400',
  },
  error: {
    icon: LuCircleX,
    iconClass: 'text-red-400',
    bar: 'bg-meat-red',
  },
  info: {
    icon: LuInfo,
    iconClass: 'text-sky-400',
    bar: 'bg-sky-400',
  },
}

function ToastItem({ item, onDismiss }) {
  const tone = TONE[item.type] ?? TONE.info
  const Icon = tone.icon
  return (
    <div
      role="status"
      className="pointer-events-auto relative flex w-[min(92vw,360px)] items-start gap-3 overflow-hidden rounded-xl border border-white/10 bg-[#1b1b1b]/95 p-3.5 pr-4 shadow-2xl backdrop-blur-md animate-slide-in"
    >
      <span className={`absolute inset-y-0 right-0 w-1 ${tone.bar}`} />
      <Icon className={`mt-0.5 size-[18px] shrink-0 ${tone.iconClass}`} />
      <p className="flex-1 text-[13px] leading-6 text-white/90">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="rounded-md p-1 text-white/35 transition hover:bg-white/5 hover:text-white"
        aria-label="بستن پیام"
      >
        <LuX className="size-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message, type = 'info', duration = 4200) => {
      if (!message) return
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setItems((current) => [...current.slice(-2), { id, message, type }])
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer))
      activeTimers.clear()
    }
  }, [])

  const api = useMemo(
    () => ({
      push,
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error', 5200),
      info: (message) => push(message, 'info'),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 left-4 z-[80] flex flex-col gap-2.5 sm:left-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((item) => (
          <ToastItem key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
