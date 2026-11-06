import { LuInbox, LuRefreshCw, LuTriangleAlert } from 'react-icons/lu'

export function ErrorState({ message, onRetry, title = 'دریافت اطلاعات ناموفق بود' }) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300">
        <LuTriangleAlert className="size-7" />
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-meat-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-5">
          <LuRefreshCw className="size-4" />
          تلاش دوباره
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action, icon: Icon = LuInbox }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/35">
        <Icon className="size-7" />
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-meat-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
