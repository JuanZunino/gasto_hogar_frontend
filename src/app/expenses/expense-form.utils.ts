import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Accept Argentine decimal notation, optionally with thousands separators. */
export function normalizeAmount(value: string): string | null {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) return null;
  const [integer, fraction = ''] = text.replaceAll('.', '').split(',');
  const decimal = `${integer.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
  return /[1-9]/.test(decimal) ? decimal : null;
}

export function positiveAmount(control: AbstractControl<string>): ValidationErrors | null {
  return normalizeAmount(control.value) ? null : { amount: true };
}

export function validDate(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return { date: true };
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? null : { date: true };
}
