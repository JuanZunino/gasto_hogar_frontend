import { categoryDistribution } from './category-distribution';
import { categoryIcon } from './category-presentation';

function category(id: number, name: string, total: string) {
  return { category: { id, name }, total };
}

describe('Category distribution', () => {
  it('uses real decimal category totals for shared proportions and keeps the original max-relative bar scale', () => {
    const rows = categoryDistribution([category(42, 'Alimentos', '68500.00'), category(99, 'Servicios', '38000.00')]);
    expect(rows.map(row => row.percentage)).toEqual(['≈64,3 %', '≈35,7 %']);
    expect(rows[0].share).toBeCloseTo(64.319248, 6);
    expect(rows[1].share).toBeCloseTo(35.680752, 6);
    expect(rows[1].offset).toBe(rows[0].share);
    expect(rows[0].share + rows[1].share).toBe(100);
    expect(rows[0].width).toBe(100);
    expect(rows[1].width).toBe(55.47);
    expect(rows[0].color).not.toBe(rows[1].color);
  });

  it('distinguishes exact percentages, rounded percentages and tiny positive shares', () => {
    expect(categoryDistribution([category(1, 'A', '1.00'), category(2, 'B', '1.00')])
      .map(row => row.percentage)).toEqual(['50 %', '50 %']);
    expect(categoryDistribution([category(1, 'A', '1.00'), category(2, 'B', '2.00')])
      .map(row => row.percentage)).toEqual(['≈33,3 %', '≈66,7 %']);
    expect(categoryDistribution([category(1, 'A', '10000.00'), category(2, 'B', '0.01')])[1].percentage).toBe('<0,1 %');
    expect(categoryDistribution([category(1, 'A', '0.01')])[0].percentage).toBe('100 %');
  });

  it('preserves precision beyond Number limits and never changes the source decimal amounts', () => {
    const input = Object.freeze([
      Object.freeze(category(1, 'Mayor', '900719925474099300.00')),
      Object.freeze(category(2, 'Mitad', '450359962737049650.00')),
      Object.freeze(category(3, 'Pequeño', '0.01')),
    ]);
    const rows = categoryDistribution(input);
    expect(rows[1].width).toBe(50);
    expect(rows[0].percentage).toBe('≈66,7 %');
    expect(rows[2].percentage).toBe('<0,1 %');
    expect(rows[2].total).toBe('0.01');
    expect(rows[0].total).toBe('900719925474099300.00');
    expect(input[0].total).toBe('900719925474099300.00');
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(100, 6);
    expect(rows.every(row => Number.isFinite(row.share) && Number.isFinite(row.width))).toBe(true);
  });

  it('handles no categories and all-zero totals without division by zero', () => {
    expect(categoryDistribution([])).toEqual([]);
    const rows = categoryDistribution([category(1, 'A', '0.00'), category(2, 'B', '0.0')]);
    expect(rows.map(row => [row.width, row.share, row.offset, row.percentage]))
      .toEqual([[0, 0, 0, '0 %'], [0, 0, 0, '0 %']]);
  });

  it('assigns presentation by name rather than IDs or API order', () => {
    const first = categoryDistribution([category(1, 'Alimentos', '1.00'), category(2, 'Servicios', '2.00')]);
    const reordered = categoryDistribution([category(500, 'Servicios', '2.00'), category(900, 'ALIMENTOS', '1.00')]);
    expect(first[0].color).toBe(reordered[1].color);
    expect(first[0].icon).toBe(reordered[1].icon);
    expect(first[1].color).toBe(reordered[0].color);
  });
});

describe('Category icon mapping', () => {
  it.each([
    ['Alimentos', 'cart'], [' ALIMENTOS ', 'cart'], ['Alimentación', 'cart'],
    ['Servicios', 'house'], ['Transporte', 'car'], ['Salud', 'cross'],
    ['Educación', 'book'], ['EDUCACION', 'book'], ['Entretenimiento', 'ticket'],
    ['Mascotas', 'category'], ['', 'category'], ['constructor', 'category'], ['__proto__', 'category'],
  ])('maps %s to the local %s icon', (name, icon) => {
    expect(categoryIcon(name)).toBe(icon);
  });
});
