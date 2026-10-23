import { Component, computed, input } from '@angular/core';
import { ArsAmountPipe } from '../expenses/ars-amount.pipe';
import { CategoryExpenses } from './dashboard.service';

// Integer cents keep decimal precision. Only the bounded visual percentage becomes a Number.
function cents(amount: string): bigint {
  const [integer, fraction = ''] = amount.split('.');
  return BigInt(`${integer}${fraction.padEnd(2, '0')}`);
}

@Component({
  selector: 'app-category-chart',
  imports: [ArsAmountPipe],
  template: `
    <h2>Gastos por categoría</h2>
    @if (bars().length) {
      <ul aria-label="Distribución de gastos por categoría en pesos argentinos">
        @for (bar of bars(); track bar.category.id) {
          <li>
            <div class="label"><span>{{ bar.category.name }}</span><strong>{{ bar.total | arsAmount }}</strong></div>
            <div class="track" aria-hidden="true"><div class="bar" [style.width.%]="bar.width"></div></div>
          </li>
        }
      </ul>
    } @else {
      <p>No hay datos de categorías para este período.</p>
    }
  `,
  styles: `
    :host { display: block; }
    h2 { font-size: 1.25rem; }
    ul { list-style: none; padding: 0; }
    li { margin-block: 1rem; }
    .label { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; overflow-wrap: anywhere; }
    .label > * { min-width: 0; }
    .track { height: 1.25rem; margin-top: 0.5rem; background: #e5e7eb; border: 1px solid #767676; border-radius: 0.25rem; overflow: hidden; }
    .bar { height: 100%; background: #1556a0; }
    @media (forced-colors: active) { .bar { background: Highlight; forced-color-adjust: none; } }
  `,
})
export class CategoryChart {
  readonly categories = input.required<CategoryExpenses[]>();
  protected readonly bars = computed(() => {
    const categories = this.categories();
    const amounts = categories.map(item => cents(item.total));
    const max = amounts.reduce((largest, amount) => amount > largest ? amount : largest, 0n);
    return categories.map((item, index) => ({
      ...item,
      width: max > 0n && amounts[index] > 0n ? Number(amounts[index] * 10000n / max) / 100 : 0,
    }));
  });
}
