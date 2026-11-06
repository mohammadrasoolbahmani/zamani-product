const FIELD_LABELS = {
  detail: '',
  non_field_errors: '',
  username: 'نام کاربری',
  password: 'رمز عبور',
  old_password: 'رمز عبور فعلی',
  new_password: 'رمز عبور جدید',
  first_name: 'نام',
  last_name: 'نام خانوادگی',
  email: 'ایمیل',
  date: 'تاریخ',
  producer: 'تولیدکننده',
  product: 'محصول',
  delivered_meat_kg: 'وزن گوشت تحویلی',
  amount_kg: 'مقدار تولید',
  packages_count: 'تعداد بسته',
  waste_kg: 'وزن معدومی',
  garri: 'گاری',
  meat_input_kg: 'وزن گوشت ورودی',
  output_kg: 'وزن خروجی',
  onion_input_kg: 'ورودی پیاز',
  chicken_input_kg: 'ورودی مرغ',
  onion_used_kg: 'پیاز مصرفی',
  chicken_used_kg: 'مرغ مصرفی',
  name: 'نام',
  is_active: 'وضعیت',
  start: 'تاریخ شروع',
  end: 'تاریخ پایان',
  days: 'تعداد روزها',
}

function firstMessage(value) {
  if (Array.isArray(value)) return firstMessage(value[0])
  if (value && typeof value === 'object') {
    return firstMessage(Object.values(value)[0])
  }
  return typeof value === 'string' ? value : ''
}

export function getApiErrorMessage(error, fallback = 'خطایی رخ داد. دوباره تلاش کنید.') {
  if (!error?.response) {
    if (error?.code === 'ECONNABORTED') {
      return 'زمان پاسخ سرور به پایان رسید. اتصال را بررسی کنید.'
    }
    return 'ارتباط با سرور برقرار نشد. از اجرای بک‌اند مطمئن شوید.'
  }

  const data = error.response.data
  if (typeof data === 'string' && data.trim()) return data
  if (!data || typeof data !== 'object') return fallback

  if (data.detail) return firstMessage(data.detail)
  if (data.non_field_errors) return firstMessage(data.non_field_errors)

  for (const [field, value] of Object.entries(data)) {
    const message = firstMessage(value)
    if (!message) continue
    const label = FIELD_LABELS[field] ?? field
    return label ? `${label}: ${message}` : message
  }
  return fallback
}

export function getFieldErrors(error) {
  const data = error?.response?.data
  if (!data || typeof data !== 'object') return {}
  const result = {}
  for (const [field, value] of Object.entries(data)) {
    if (field === 'detail' || field === 'non_field_errors') continue
    const message = firstMessage(value)
    if (message) result[field] = message
  }
  return result
}
