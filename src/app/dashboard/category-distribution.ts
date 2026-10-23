import { CategoryExpenses } from './dashboard.service';
import { CATEGORY_COLORS, categoryIcon, normalizedCategoryName } from './category-presentation';

// Amounts remain decimal strings. Integer cents are used only to derive chart proportions.
function cents(amount: string): bigint {
  const [integer, fraction = ''] = amount.split('.');
  return BigInt(`${integer}${fraction.padEnd(2, '0')}`);
}

function percentageLabel(amount: bigint, total: bigint): string {
  if (total === 0n || amount === 0n) return '0 %';
  const numerator = amount * 1000n;
  const rounded = (numerator + total / 2n) / total;
  if (rounded === 0n) return '<0,1 %';
  const fraction = rounded % 10n;
  const value = `${rounded / 10n}${fraction ? `,${fraction}` : ''} %`;
  return numerator % total === 0n ? value : `≈${value}`;
}

export function categoryDistribution(categories: readonly CategoryExpenses[]) {
  const amounts = categories.map(item => {
    const amount = cents(item.total);
    return amount > 0n ? amount : 0n;
  });
  const total = amounts.reduce((sum, amount) => sum + amount, 0n);
  const max = amounts.reduce((largest, amount) => amount > largest ? amount : largest, 0n);
  // Assign colors by name, independently of API order and database IDs.
  const names = [...new Set(categories.map(item => normalizedCategoryName(item.category.name)))].sort();
  const colors = new Map(names.map((name, index) => [name, CATEGORY_COLORS[index % CATEGORY_COLORS.length]]));
  let cumulative = 0n;
  return categories.map((item, index) => {
    const amount = amounts[index];
    const start = total ? cumulative * 100000000n / total : 0n;
    cumulative += amount;
    const end = total ? cumulative * 100000000n / total : 0n;
    return {
      ...item,
      icon: categoryIcon(item.category.name),
      color: colors.get(normalizedCategoryName(item.category.name))!,
      width: max ? Number(amount * 10000n / max) / 100 : 0,
      percentage: percentageLabel(amount, total),
      share: Number(end - start) / 1000000,
      offset: Number(start) / 1000000,
    };
  });
}

export type CategoryDistribution = ReturnType<typeof categoryDistribution>;
