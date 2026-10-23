import { Component, computed, input } from '@angular/core';
import { ArsAmountPipe } from '../expenses/ars-amount.pipe';
import { CategoryExpenses } from './dashboard.service';
import { categoryDistribution } from './category-distribution';
import { CategoryDonut } from './category-donut';
import { DashboardIcon } from './dashboard-icon';

@Component({
  selector: 'app-category-chart',
  imports: [ArsAmountPipe, CategoryDonut, DashboardIcon],
  template: `
    @if (bars().length) {
      <div class="charts">
        <section class="chart-panel" aria-label="Gráfico de barras por categoría">
          <h2>Gastos por categoría</h2>
          <p class="description">Comparación por importe</p>
          <ul class="bars" aria-label="Gastos por categoría en pesos argentinos y porcentaje">
            @for (bar of bars(); track bar.category.id) {
              <li>
                <div class="label">
                  <span class="category"><span class="category-icon" [style.background-color]="bar.color"><app-dashboard-icon [name]="bar.icon" /></span>{{ bar.category.name }}</span>
                  <span class="values"><strong>{{ bar.total | arsAmount }}</strong><span class="percentage">{{ bar.percentage }}</span></span>
                </div>
                <div class="track" aria-hidden="true"><div class="bar" [style.width.%]="bar.width" [style.background-color]="bar.color"></div></div>
              </li>
            }
          </ul>
        </section>
        <section class="chart-panel" aria-label="Gráfico de dona por categoría">
          <app-category-donut [distribution]="bars()" />
        </section>
      </div>
      <p class="rounding-note">Los porcentajes se calculan sobre la suma de categorías. ≈ indica un porcentaje aproximado; &lt;0,1 % indica una participación menor al 0,1 %.</p>
    } @else {
      <h2>Gastos por categoría</h2>
      <p>No hay datos de categorías para este período.</p>
    }
  `,
  styleUrl: './category-chart.scss',
})
export class CategoryChart {
  readonly categories = input.required<CategoryExpenses[]>();
  protected readonly bars = computed(() => categoryDistribution(this.categories()));
}
