import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuImagePlus,
  LuLoaderCircle,
  LuPackage,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTrash2,
} from 'react-icons/lu'
import api from '../api/client'
import { getApiErrorMessage, getFieldErrors } from '../api/errors'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState, ErrorState } from '../components/States'
import { StatusBadge } from '../components/Badges'
import { ProductAvatar } from '../components/BrandLogo'
import { formatJalali } from '../utils/date'
import { formatNumber } from '../utils/format'

const emptyForm = { name: '', is_active: true, imageFile: null, preview: '' }

export default function Products() {
  const { user } = useAuth()
  const canManage = Boolean(user?.is_staff)
  const toast = useToast()
  const fileRef = useRef(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/products/?page_size=100')
      setProducts(data.results ?? data)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'دریافت فهرست محصولات ناموفق بود.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(
    () => () => {
      if (form.preview?.startsWith('blob:')) URL.revokeObjectURL(form.preview)
    },
    [form.preview],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products
    return products.filter((product) => product.name.toLowerCase().includes(term))
  }, [products, search])

  const stats = useMemo(
    () => ({
      total: products.length,
      active: products.filter((product) => product.is_active).length,
      records: products.reduce((sum, product) => sum + (product.records_count || 0), 0),
    }),
    [products],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFieldErrors({})
    setFormOpen(true)
  }

  const openEdit = (product) => {
    setEditing(product)
    setForm({
      name: product.name,
      is_active: product.is_active,
      imageFile: null,
      preview: product.image_url || '',
    })
    setFieldErrors({})
    setFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    if (form.preview?.startsWith('blob:')) URL.revokeObjectURL(form.preview)
  }

  const handleFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFieldErrors((current) => ({ ...current, image: 'فقط فایل تصویر مجاز است.' }))
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setFieldErrors((current) => ({ ...current, image: 'حجم تصویر باید کمتر از ۴ مگابایت باشد.' }))
      return
    }
    if (form.preview?.startsWith('blob:')) URL.revokeObjectURL(form.preview)
    setForm((current) => ({
      ...current,
      imageFile: file,
      preview: URL.createObjectURL(file),
    }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.image
      return next
    })
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setFieldErrors({ name: 'نام محصول را وارد کنید.' })
      return
    }
    setSaving(true)
    try {
      const payload = new FormData()
      payload.append('name', form.name.trim())
      payload.append('is_active', String(form.is_active))
      if (form.imageFile) payload.append('image', form.imageFile)

      if (editing) {
        const { data } = await api.patch(`/products/${editing.id}/`, payload)
        setProducts((current) => current.map((item) => (item.id === data.id ? data : item)))
        toast.success('محصول به‌روزرسانی شد.')
      } else {
        const { data } = await api.post('/products/', payload)
        setProducts((current) =>
          [...current, { ...data, records_count: data.records_count ?? 0 }].sort((a, b) =>
            a.name.localeCompare(b.name, 'fa'),
          ),
        )
        toast.success(`محصول «${data.name}» ایجاد شد.`)
      }
      setFormOpen(false)
    } catch (requestError) {
      setFieldErrors(getFieldErrors(requestError))
      toast.error(getApiErrorMessage(requestError, 'ذخیره محصول ناموفق بود.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/products/${deleteTarget.id}/`)
      setProducts((current) => current.filter((item) => item.id !== deleteTarget.id))
      toast.success('محصول حذف شد.')
      setDeleteTarget(null)
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'حذف محصول ناموفق بود.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="کاتالوگ تولید"
        title="مدیریت محصولات"
        description="محصولات قابل تولید را مدیریت کنید؛ محصولات غیرفعال در فرم ثبت آمار نمایش داده نمی‌شوند."
        icon={LuPackage}
        actions={
          canManage ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              <LuPlus className="size-4" />
              افزودن محصول
            </button>
          ) : (
            <span className="chip border-white/10 bg-white/[0.04] text-white/45">
              نمایش فقط‌خواندنی
            </span>
          )
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'کل محصولات', value: stats.total },
          { label: 'محصولات فعال', value: stats.active },
          { label: 'سوابق ثبت‌شده', value: stats.records },
        ].map((item) => (
          <div key={item.label} className="panel flex flex-col justify-between gap-2 p-3 sm:flex-row sm:items-center sm:p-4">
            <span className="text-[9.5px] leading-4 text-white/40 sm:text-[11px]">{item.label}</span>
            <span className="text-lg font-extrabold text-white sm:text-xl">{formatNumber(item.value)}</span>
          </div>
        ))}
      </div>

      <section className="panel min-w-0 overflow-hidden">
        <div className="panel-header flex-col !items-stretch gap-3 sm:flex-row sm:!items-center">
          <div>
            <h2 className="panel-title">
              <LuPackage className="size-[18px] text-meat-red" />
              کاتالوگ محصولات
            </h2>
            <p className="panel-subtitle">{formatNumber(filtered.length)} محصول</p>
          </div>
          <div className="relative w-full sm:max-w-[230px]">
            <LuSearch className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی محصول…"
              className="input py-2 pr-9 text-[12px]"
              aria-label="جستجوی محصول"
            />
          </div>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="table-wrap">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>محصول</th>
                  <th>وضعیت</th>
                  <th>تعداد سوابق</th>
                  <th>تاریخ ایجاد</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <ProductAvatar name={product.name} image={product.image_url} size="md" />
                        <div>
                          <p className="font-medium text-white/85">{product.name}</p>
                          <p className="mt-1 text-[9px] text-white/25">
                            شناسه: {formatNumber(product.id)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge active={product.is_active} />
                    </td>
                    <td className="text-white/60">{formatNumber(product.records_count || 0)}</td>
                    <td className="text-white/45">{formatJalali(product.created_at?.slice(0, 10))}</td>
                    <td>
                      {canManage ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="btn-secondary !px-2.5 !py-1.5 text-[10px]"
                          >
                            <LuPencil className="size-3.5" />
                            ویرایش
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(product)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/[0.08] text-red-300/80 transition hover:bg-red-500/20 hover:text-red-200"
                            aria-label={`حذف محصول ${product.name}`}
                          >
                            <LuTrash2 className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={search ? 'محصولی پیدا نشد' : 'هنوز محصولی ثبت نشده'}
            description={search ? 'عبارت جستجو را تغییر دهید.' : 'اولین محصول کارخانه را به کاتالوگ اضافه کنید.'}
            icon={LuPackage}
            action={
              !search &&
              canManage && (
                <button type="button" onClick={openCreate} className="btn-primary">
                  <LuPlus className="size-4" />
                  افزودن محصول
                </button>
              )
            }
          />
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'ویرایش محصول' : 'افزودن محصول'}
        subtitle={editing ? 'اطلاعات محصول را به‌روزرسانی کنید.' : 'محصول جدید را به کاتالوگ تولید اضافه کنید.'}
        icon={editing ? LuPencil : LuPackage}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>
              انصراف
            </button>
            <button type="submit" form="product-form" className="btn-primary" disabled={saving}>
              {saving ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuPackage className="size-4" />}
              {saving ? 'در حال ذخیره…' : 'ذخیره محصول'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-5" noValidate>
          <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <ProductAvatar name={form.name || 'محصول'} image={form.preview} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-white/75">تصویر محصول</p>
              <p className="mt-1 text-[10px] leading-5 text-white/30">
                تصویر مربعی با حجم کمتر از ۴ مگابایت. اختیاری است.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-secondary mt-2 !px-2.5 !py-1.5 text-[10px]"
              >
                <LuImagePlus className="size-3.5" />
                انتخاب تصویر
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
          </div>
          {fieldErrors.image && <p className="-mt-2 text-[10px] text-red-300">{fieldErrors.image}</p>}

          <div>
            <label htmlFor="product-name" className="field-label">نام محصول</label>
            <input
              id="product-name"
              className={`input ${fieldErrors.name ? 'input-error' : ''}`}
              value={form.name}
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }))
                setFieldErrors((current) => {
                  const next = { ...current }
                  delete next.name
                  return next
                })
              }}
              placeholder="مثلاً همبرگر ۹۰٪"
              autoFocus
            />
            {fieldErrors.name && <p className="mt-1.5 text-[10px] text-red-300">{fieldErrors.name}</p>}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
              className="h-4 w-4 accent-[#c91c1c]"
            />
            <span>
              <span className="block text-[12px] text-white/75">محصول فعال باشد</span>
              <span className="mt-0.5 block text-[10px] text-white/30">
                محصولات غیرفعال در فرم ثبت تولید نمایش داده نمی‌شوند.
              </span>
            </span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        loading={deleting}
        title={deleteTarget?.records_count ? 'حذف محصول امکان‌پذیر نیست' : 'حذف محصول'}
        description={
          deleteTarget
            ? deleteTarget.records_count
              ? `محصول «${deleteTarget.name}» ${formatNumber(deleteTarget.records_count)} سابقه تولید دارد و قابل حذف نیست؛ می‌توانید آن را غیرفعال کنید.`
              : `آیا از حذف محصول «${deleteTarget.name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`
            : ''
        }
        confirmLabel={deleteTarget?.records_count ? 'متوجه شدم' : 'حذف محصول'}
        cancelLabel="انصراف"
        tone="danger"
        onConfirm={deleteTarget?.records_count ? () => setDeleteTarget(null) : handleDelete}
      />
    </div>
  )
}
