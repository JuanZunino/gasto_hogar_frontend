import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ArsAmountPipe } from '../expenses/ars-amount.pipe';
import { ExpenseOption, ExpenseOptionsService } from '../expenses/expense-options.service';
import { expenseErrors } from '../expenses/expense-errors';
import { isValidDate } from '../expenses/expense-form.utils';
import { CategoryChart } from './category-chart';
import { DashboardIcon } from './dashboard-icon';
import { DashboardPeriod, DashboardService, DashboardSummary } from './dashboard.service';

type DashboardState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'loaded'; summary: DashboardSummary }
  | { status: 'error'; errors: string[] };

@Component({
  selector: 'app-dashboard',
  imports: [FormField, ArsAmountPipe, CategoryChart, DashboardIcon],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly service = inject(DashboardService);
  private readonly optionsService = inject(ExpenseOptionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly fromInput = viewChild.required<ElementRef<HTMLInputElement>>('fromInput');
  private request?: Subscription;
  private householdsRequest?: Subscription;
  private readonly householdsReady = signal(false);
  protected readonly households = signal<ExpenseOption[]>([]);
  protected readonly householdsLoading = signal(false);
  protected readonly householdsErrors = signal<string[]>([]);
  protected readonly householdNotice = signal('');
  private readonly period = signal({ from: '', to: '', household_id: '' });
  private readonly submitted = signal(false);
  protected readonly applied = signal<DashboardPeriod & { household_id?: string }>({});
  protected readonly appliedHousehold = computed(() => this.households()
    .find(household => String(household.id) === this.applied().household_id)?.name ?? '');
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
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.restoreFilters());
    this.loadHouseholds();
  }

  ngAfterViewInit(): void { this.heading().nativeElement.focus(); }

  protected loadHouseholds(): void {
    this.householdsRequest?.unsubscribe();
    this.householdsReady.set(false);
    this.householdsLoading.set(true);
    this.householdsErrors.set([]);
    if (this.route.snapshot.queryParamMap.get('household_id')) {
      this.request?.unsubscribe();
      this.state.set({ status: 'loading' });
    }
    this.householdsRequest = this.optionsService.households().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: households => {
        this.households.set(households);
        this.householdsReady.set(true);
        this.householdsLoading.set(false);
        if (this.route.snapshot.queryParamMap.get('household_id')) this.restoreFilters();
      },
      error: (error: unknown) => {
        this.householdsLoading.set(false);
        this.households.set([]);
        this.householdsErrors.set(expenseErrors(error, 'No se pudieron cargar los hogares. Podés consultar Mis gastos o reintentar.'));
        if (this.route.snapshot.queryParamMap.get('household_id')) {
          this.state.set({ status: 'error', errors: this.householdsErrors() });
        }
      },
    });
  }

  private restoreFilters(): void {
    this.request?.unsubscribe();
    const params = this.route.snapshot.queryParamMap;
    const householdId = params.get('household_id') ?? '';
    this.period.set({ from: params.get('from') ?? '', to: params.get('to') ?? '', household_id: '' });
    this.submitted.set(true);
    if (householdId && !this.householdsReady()) {
      this.state.set(this.householdsErrors().length
        ? { status: 'error', errors: this.householdsErrors() } : { status: 'loading' });
      return;
    }
    if (householdId && !this.households().some(household => String(household.id) === householdId)) {
      this.state.set({ status: 'loading' });
      this.householdNotice.set('El hogar ya no está disponible. Se seleccionó Mis gastos.');
      void this.router.navigate([], { relativeTo: this.route,
        queryParams: { household_id: null }, queryParamsHandling: 'merge', replaceUrl: true });
      return;
    }
    this.period.update(period => ({ ...period, household_id: householdId }));
    if (this.filters().invalid()) {
      this.state.set({ status: 'invalid' });
      return;
    }
    this.applied.set(this.selectedPeriod());
    this.load();
  }

  private selectedPeriod(): DashboardPeriod & { household_id?: string } {
    const { from, to, household_id } = this.period();
    return { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(household_id ? { household_id } : {}) };
  }

  protected selectHousehold(householdId: string): void {
    if ((householdId === this.period().household_id &&
      householdId === (this.route.snapshot.queryParamMap.get('household_id') ?? '')) ||
      (householdId && !this.households().some(household => String(household.id) === householdId))) return;
    this.request?.unsubscribe();
    this.householdNotice.set('');
    this.period.update(period => ({ ...period, household_id: householdId }));
    this.state.set({ status: 'invalid' });
    this.applyFilters();
  }

  protected applyFilters(): void {
    this.submitted.set(true);
    if (this.filters().invalid()) {
      this.fromInput().nativeElement.focus();
      return;
    }
    const selected = this.selectedPeriod();
    const params = this.route.snapshot.queryParamMap;
    const unchanged = (['from', 'to', 'household_id'] as const)
      .every(key => (selected[key] ?? '') === (params.get(key) ?? ''));
    if (unchanged) {
      this.applied.set(selected);
      this.load();
    } else {
      const url = this.router.createUrlTree([], { relativeTo: this.route, queryParams: selected });
      void this.router.navigateByUrl(url);
    }
  }

  protected clearFilters(): void {
    this.householdNotice.set('');
    this.period.set({ from: '', to: '', household_id: '' });
    this.applyFilters();
  }

  private load(): void {
    this.request?.unsubscribe();
    const householdId = this.applied().household_id;
    if (householdId && (!this.householdsReady() ||
      !this.households().some(household => String(household.id) === householdId))) {
      this.restoreFilters();
      return;
    }
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
    if (!this.householdsReady() && this.route.snapshot.queryParamMap.get('household_id')) this.loadHouseholds();
    else this.load();
  }
}
