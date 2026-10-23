import { DashboardIconName } from './dashboard-icon';

export const CATEGORY_COLORS = ['#9bb9f5', '#a6d9bf', '#c5b3e9', '#f1c19e', '#99d3d6', '#e9b2cf', '#ced597', '#b9c7df'] as const;

const icons: Readonly<Record<string, DashboardIconName>> = {
  alimentos: 'cart', alimentacion: 'cart',
  servicios: 'house', transporte: 'car', salud: 'cross',
  educacion: 'book', entretenimiento: 'ticket',
};

export function normalizedCategoryName(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
}

export function categoryIcon(name: string): DashboardIconName {
  const normalized = normalizedCategoryName(name);
  return Object.hasOwn(icons, normalized) ? icons[normalized] : 'category';
}

export function categoryColors(names: readonly string[]): ReadonlyMap<string, string> {
  const normalized = [...new Set(names.map(normalizedCategoryName))].sort();
  return new Map(normalized.map((name, index) => [name, CATEGORY_COLORS[index % CATEGORY_COLORS.length]]));
}
