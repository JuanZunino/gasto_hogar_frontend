import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ArsAmountPipe } from '../expenses/ars-amount.pipe';
import { expenseErrors } from '../expenses/expense-errors';
import { isValidDate } from '../expenses/expense-form.utils';
import { CategoryChart } from './category-chart';
import { DashboardPeriod, DashboardService, DashboardSummary } from './dashboard.service';

type DashboardState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'loaded'; summary: DashboardSummary }
  | { status: 'error'; errors: string[] };

@Component({
  selector: 'app-dashboard',
  imports: [FormField, ArsAmountPipe, CategoryChart],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly service = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly fromInput = viewChild.required<ElementRef<HTMLInputElement>>('fromInput');
  private request?: Subscription;
  private readonly period = signal({ from: '', to: '' });
  private readonly submitted = signal(false);
  protected readonly applied = signal<DashboardPeriod>({});
  protected readonly hasPeriod = computed(() => !!(this.applied().from || this.applied().to));
  protected readonly state = signal<DashboardState>({ status: 'loading' });
  protected readonly filters = form(this.period, path => {
    validate(path, ({ value }) => {
      const { from, to } = value();
      if ((from && !isValidDate(from)) || (to && !isValidDate(to))) {
        return { kind: 'date', message: 'Ingresá fechas válidas con formato YYYY-MM-DD.' };
      }
      return from && to && from > to
        ? { kind: 'range', message: 'La fecha desde no puede ser posterior a la fecha hasta.' }
        : undefined;
    });
  });
  protected readonly filterError = computed(() => this.submitted()
    ? this.filters().errors()[0]?.message ?? '' : '');

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.request?.unsubscribe();
      this.period.set({ from: params.get('from') ?? '', to: params.get('to') ?? '' });
      this.submitted.set(true);
      if (this.filters().invalid()) {
        this.state.set({ status: 'invalid' });
        return;
      }
      this.applied.set(this.selectedPeriod());
      this.load();
    });
  }

  ngAfterViewInit(): void { this.heading().nativeElement.focus(); }

  private selectedPeriod(): DashboardPeriod {
    const { from, to } = this.period();
    return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  }

  protected applyFilters(): void {
    this.submitted.set(true);
    if (this.filters().invalid()) {
      this.fromInput().nativeElement.focus();
      return;
    }
    const url = this.router.createUrlTree([], { relativeTo: this.route, queryParams: this.selectedPeriod() });
    if (this.router.serializeUrl(url) === this.router.url) this.load();
    else void this.router.navigateByUrl(url);
  }

  protected clearFilters(): void {
    this.period.set({ from: '', to: '' });
    this.applyFilters();
  }

  private load(): void {
    this.request?.unsubscribe();
    this.state.set({ status: 'loading' });
    this.request = this.service.get(this.applied()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summary => this.state.set({ status: 'loaded', summary }),
      error: (error: unknown) => this.state.set({ status: 'error',
        errors: expenseErrors(error, 'No se pudo cargar el resumen de gastos. Verificá tu conexión e intentá nuevamente.') }),
    });
  }

  protected retry(): void {
    if (this.state().status !== 'error') return;
    this.heading().nativeElement.focus();
    this.load();
  }
}
