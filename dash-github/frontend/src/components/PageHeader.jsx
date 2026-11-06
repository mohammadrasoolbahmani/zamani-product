export default function PageHeader({ icon: Icon, eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <div className="mt-0.5 hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-meat-red/30 bg-meat-red/10 text-meat-red shadow-red-glow sm:flex">
            <Icon className="size-6" />
          </div>
        )}
        <div>
          {eyebrow && (
            <p className="mb-1 text-[11px] font-medium tracking-wide text-meat-red">
              {eyebrow}
            </p>
          )}
          <h1 className="text-balance text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-meat-muted">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
