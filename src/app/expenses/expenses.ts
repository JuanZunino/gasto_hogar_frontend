import { DashboardIcon } from '../dashboard/dashboard-icon';
import { HttpErrorResponse } from '@angular/common/http';
import { categoryColors, categoryIcon, normalizedCategoryName } from '../dashboard/category-presentation';
import { DatePipe } from '@angular/common';
import { afterNextRender, Component, DestroyRef, ElementRef, computed, inject, Injector, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { expenseErrors } from './expense-errors';
import { ArsAmountPipe } from './ars-amount.pipe';
import { Expense } from './expense';
import { ExpenseFilters, ExpensesService } from './expenses.service';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { ExpenseOption, ExpenseOptionsService } from './expense-options.service';
import { validDate } from './expense-form.utils';

type ExpensesState =
  | { status: 'loading' }
  | { status: 'loaded'; expenses: Expense[] }
  | { status: 'error'; errors: string[] };

@Component({
  selector: 'app-expenses',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, ArsAmountPipe, DashboardIcon],
  templateUrl: './expenses.html',
  styleUrl: './expenses.scss',
})
export class Expenses {
  private readonly injector = inject(Injector);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(ExpensesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly success = signal(this.service.notice());
  protected readonly pendingDelete = signal<Expense | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteErrors = signal<string[]>([]);
  protected readonly state = signal<ExpensesState>({ status: 'loading' });

  protected readonly expenseCards = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    const colors = categoryColors(state.expenses.map(expense => expense.category.name));
    return state.expenses.map(expense => ({
      expense,
      icon: categoryIcon(expense.category.name),
      color: colors.get(normalizedCategoryName(expense.category.name)),
    }));
  });

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly optionsService = inject(ExpenseOptionsService);
  private listSubscription?: Subscription;
  protected readonly filters = inject(FormBuilder).nonNullable.group({
    from: [''], to: [''], category_id: [''], household_id: [''],
  });
  protected readonly applied = signal<ExpenseFilters>({});
  protected readonly hasFilters = computed(() => Object.keys(this.applied()).length > 0);
  protected readonly filterError = signal('');
  protected readonly options = signal<{ categories: ExpenseOption[]; households: ExpenseOption[] }>({ categories: [], households: [] });
  protected readonly optionsLoading = signal(false);
  protected readonly optionsErrors = signal<string[]>([]);

  protected loadOptions(): void {
    this.optionsLoading.set(true);
    this.optionsErrors.set([]);
    forkJoin({ categories: this.optionsService.categories(), households: this.optionsService.households() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: options => { this.options.set(options); this.optionsLoading.set(false); },
        error: (error: unknown) => {
          this.optionsLoading.set(false);
          this.optionsErrors.set(expenseErrors(error, 'No se pudieron cargar las categorías y los hogares.'));
        },
      });
  }

  private validationError(): string {
    const { from, to, category_id, household_id } = this.filters.getRawValue();
    if ((from && validDate(this.filters.controls.from)) || (to && validDate(this.filters.controls.to))) {
      return 'Ingresá fechas válidas con formato YYYY-MM-DD.';
    }
    if (from && to && from > to) return 'La fecha desde no puede ser posterior a la fecha hasta.';
    if ([category_id, household_id].some(value => value && !/^[1-9]\d*$/.test(value))) {
      return 'La categoría y el hogar deben tener identificadores válidos.';
    }
    return '';
  }

  protected missingOption(key: 'category_id' | 'household_id'): boolean {
    const value = this.filters.controls[key].value;
    const options = key === 'category_id' ? this.options().categories : this.options().households;
    return !!value && !options.some(option => String(option.id) === value);
  }

  protected applyFilters(): void {
    if (this.deleting()) return;
    this.filterError.set(this.validationError());
    if (this.filterError()) return;
    const selected = Object.fromEntries(Object.entries(this.filters.getRawValue()).filter(([, value]) => value));
    const url = this.router.createUrlTree([], { relativeTo: this.route, queryParams: selected });
    if (this.router.serializeUrl(url) === this.router.url) this.load();
    else void this.router.navigateByUrl(url);
  }

  protected clearFilters(): void {
    if (this.deleting()) return;
    this.filters.reset();
    this.applyFilters();
  }

  ngOnInit(): void {
    this.service.notice.set('');
    this.loadOptions();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.listSubscription?.unsubscribe();
      this.filters.reset({ from: params.get('from') ?? '', to: params.get('to') ?? '',
        category_id: params.get('category_id') ?? '', household_id: params.get('household_id') ?? '' });
      this.filterError.set(this.validationError());
      if (this.filterError()) {
        this.state.set({ status: 'error', errors: ['Corregí los filtros de la URL o limpiá los filtros para cargar los gastos.'] });
        return;
      }
      this.applied.set(Object.fromEntries(Object.entries(this.filters.getRawValue()).filter(([, value]) => value)));
      this.pendingDelete.set(null);
      this.load();
    });
  }

  ngAfterViewInit(): void {
    this.heading().nativeElement.focus();
  }

  protected load(): void {
    this.listSubscription?.unsubscribe();
    this.state.set({ status: 'loading' });
    this.listSubscription = this.service.list(this.applied()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (expenses) => this.state.set({ status: 'loaded', expenses }),
      error: (error: unknown) => this.state.set({ status: 'error', errors: expenseErrors(error, 'No se pudieron cargar tus gastos. Verificá tu conexión e intentá nuevamente.') }),
    });
  }

  protected confirmDelete(expense: Expense): void {
    if (this.deleting() || expense.can_delete !== true) return;
    this.deleteErrors.set([]);
    this.pendingDelete.set(expense);
    afterNextRender(() => this.element.nativeElement.querySelector<HTMLElement>('.confirmation h3')?.focus(),
      { injector: this.injector });
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.pendingDelete.set(null);
    this.deleteErrors.set([]);
    this.heading().nativeElement.focus();
  }

  protected deleteExpense(): void {
    const expense = this.pendingDelete();
    if (!expense || this.deleting() || expense.can_delete !== true) return;
    this.deleting.set(true);
    this.deleteErrors.set([]);
    this.service.delete(expense.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.state.update(state => state.status === 'loaded'
          ? { ...state, expenses: state.expenses.filter(item => item.id !== expense.id) } : state);
        this.success.set(`Gasto «${expense.description}» eliminado correctamente.`);
        this.heading().nativeElement.focus();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.listSubscription?.unsubscribe();
          this.pendingDelete.set(null);
          this.deleteErrors.set([]);
          this.success.set('');
          this.state.set({ status: 'error', errors: expenseErrors(error, 'Gasto no encontrado.') });
          this.heading().nativeElement.focus();
          return;
        }
        this.deleteErrors.set(expenseErrors(error, 'No se pudo eliminar el gasto. Verificá tu conexión e intentá nuevamente.'));
      },
    });
  }

  protected retry(): void {
    if (this.state().status === 'loading' || this.filterError()) return;
    this.heading().nativeElement.focus();
    this.load();
  }
}
