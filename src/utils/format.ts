export function formatCurrency(amount: number, symbol = '$'): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
}

function getActiveLocale(lang?: 'en' | 'ar'): string {
  const resolved =
    lang ??
    (typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en');
  return resolved === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
}

export function formatDateShort(isoString: string, lang?: 'en' | 'ar'): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(getActiveLocale(lang), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(isoString: string, lang?: 'en' | 'ar'): string {
  const date = new Date(isoString);
  return date.toLocaleString(getActiveLocale(lang), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function toDateKey(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSameDay(isoString: string, target: Date = new Date()): boolean {
  return toDateKey(isoString) === toDateKey(target);
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getStockStatus(stock: number, reorderLevel: number): 'out' | 'low' | 'in' {
  if (stock <= 0) return 'out';
  if (stock <= reorderLevel) return 'low';
  return 'in';
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
