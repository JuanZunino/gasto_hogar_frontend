import { Component, input } from '@angular/core';
import { ArsAmountPipe } from '../expenses/ars-amount.pipe';
import { CategoryDistribution } from './category-distribution';
import { DashboardIcon } from './dashboard-icon';

@Component({
  selector: 'app-category-donut',
  imports: [ArsAmountPipe, DashboardIcon],
  template: `
    <h2>Distribución de gastos</h2>
    <p class="description">Participación de cada categoría</p>
    <svg class="donut" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="43" fill="none" stroke="#edf0f5" stroke-width="16" />
      @for (row of distribution(); track row.category.id) {
        @if (row.share > 0) {
          <circle class="segment" cx="60" cy="60" r="43" fill="none" stroke-width="16" pathLength="100"
            [attr.stroke]="row.color" [attr.stroke-dasharray]="row.share + ' ' + (100 - row.share)"
            [attr.stroke-dashoffset]="-row.offset" transform="rotate(-90 60 60)" />
        }
      }
      <text x="60" y="62" text-anchor="middle">Tus gastos</text>
    </svg>
    <ul aria-label="Distribución por categoría: nombre, porcentaje e importe en pesos argentinos">
      @for (row of distribution(); track row.category.id) {
        <li>
          <span class="legend-icon" [style.background-color]="row.color"><app-dashboard-icon [name]="row.icon" /></span>
          <span class="legend-label">{{ row.category.name }}<strong>{{ row.total | arsAmount }}</strong></span>
          <span class="percentage">{{ row.percentage }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    h2 { margin: 0; font-size: 1.1rem; }
    .description { margin: 0.5rem 0; color: var(--text-muted); font-size: 0.9rem; }
    .donut { display: block; width: min(100%, 16rem); margin: 1.25rem auto; }
    text { font: 600 6px system-ui, sans-serif; fill: var(--text-muted); }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem; }
    li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 0.65rem; font-size: 0.9rem; }
    .legend-icon { display: inline-flex; color: #24324a; padding: 0.4rem; border-radius: 0.65rem; }
    .legend-label { min-width: 0; overflow-wrap: anywhere; }
    strong { display: block; font-size: 0.85rem; }
    .percentage { font-weight: 600; color: var(--text-muted); }
    @media (max-width: 24rem) { li { grid-template-columns: auto minmax(0, 1fr); } .percentage { grid-column: 2; } }
  `,
})
export class CategoryDonut {
  readonly distribution = input.required<CategoryDistribution>();
}
