import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, of, Subscription } from 'rxjs';
import { ExpenseOptionsService, ExpenseOption } from './expense-options.service';
import { normalizeAmount, positiveAmount, validDate } from './expense-form.utils';
import { expenseErrors } from './expense-errors';
import { ExpensesService } from './expenses.service';

type OptionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; categories: ExpenseOption[]; households: ExpenseOption[] };

@Component({
  selector: 'app-new-expense',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './new-expense.html',
  styleUrl: './new-expense.scss',
})
export class NewExpense {
  private readonly expenses = inject(ExpensesService);
  private readonly optionsService = inject(ExpenseOptionsService);
  private readonly route = inject(ActivatedRoute);
  private loadSubscription?: Subscription;
  protected get expenseId(): string | null { return this.route.snapshot.paramMap.get('id'); }
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly options = signal<OptionsState>({ status: 'loading' });
  protected readonly sending = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    description: ['', [Validators.required, Validators.pattern(/\S/)]],
    amount: ['', [Validators.required, positiveAmount]],
    date: ['', [Validators.required, validDate]],
    category_id: [null as number | null, Validators.required],
    household_id: [null as number | null],
    notes: [''],
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadOptions());
  }
  ngAfterViewInit(): void { this.heading().nativeElement.focus(); }

  protected loadOptions(): void {
    this.loadSubscription?.unsubscribe();
    this.options.set({ status: 'loading' });
    this.errors.set([]);
    const id = this.expenseId;
    this.loadSubscription = forkJoin({
      categories: this.optionsService.categories(), households: this.optionsService.households(),
      expense: id ? this.expenses.get(id) : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ expense, ...options }) => {
        if (expense) {
          this.form.reset({
            description: expense.description, amount: expense.amount.replace('.', ','), date: expense.date,
            category_id: expense.category.id, household_id: expense.household?.id ?? null, notes: expense.notes ?? '',
          });
        }
        this.options.set({ status: 'loaded', ...options });
      },
      error: (error: unknown) => {
        this.options.set({ status: 'error' });
        this.errors.set(expenseErrors(error, 'No se pudieron cargar los datos. Verificá tu conexión e intentá nuevamente.'));
      },
    });
  }

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected submit(): void {
    if (this.sending()) return;
    this.form.markAllAsTouched();
    const options = this.options();
    const value = this.form.getRawValue();
    const amount = normalizeAmount(value.amount);
    if (this.form.invalid || !amount || options.status !== 'loaded' ||
      !options.categories.some(category => category.id === value.category_id) ||
      (value.household_id !== null && !options.households.some(home => home.id === value.household_id))) return;

    this.sending.set(true);
    this.errors.set([]);
    const payload = {
      description: value.description.trim(), amount, date: value.date,
      category_id: value.category_id!, household_id: value.household_id,
      ...(this.expenseId || value.notes.trim() ? { notes: value.notes.trim() } : {}),
    };
    const request = this.expenseId ? this.expenses.update(this.expenseId, payload) : this.expenses.create(payload);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.sending.set(false))).subscribe({
      next: () => {
        this.expenses.notice.set(this.expenseId ? 'Gasto actualizado correctamente.' : 'Gasto creado correctamente.');
        void this.router.navigateByUrl('/gastos');
      },
      error: (error: unknown) => {
        this.errors.set(expenseErrors(error, 'No se pudo guardar el gasto. Verificá tu conexión e intentá nuevamente.'));
      },
    });
  }
}
