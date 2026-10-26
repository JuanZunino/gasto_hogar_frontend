import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, of, Subscription } from 'rxjs';
import { ExpenseOptionsService, ExpenseOption } from './expense-options.service';
import { maximumAmount, normalizeAmount, positiveAmount, validDate } from './expense-form.utils';
import { expenseErrors } from './expense-errors';
import { DashboardIcon } from '../dashboard/dashboard-icon';
import { ExpensesService } from './expenses.service';

type OptionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'denied' }
  | { status: 'loaded'; categories: ExpenseOption[]; households: ExpenseOption[] };

@Component({
  selector: 'app-new-expense',
  imports: [ReactiveFormsModule, RouterLink, DashboardIcon],
  templateUrl: './new-expense.html',
  styleUrl: './new-expense.scss',
})
export class NewExpense {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly expenses = inject(ExpensesService);
  private readonly optionsService = inject(ExpenseOptionsService);
  private readonly route = inject(ActivatedRoute);
  private categorySubscription?: Subscription;
  private loadSubscription?: Subscription;
  private readonly canEdit = signal(false);
  protected get expenseId(): string | null { return this.route.snapshot.paramMap.get('id'); }
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly categoryName = viewChild.required<ElementRef<HTMLInputElement>>('categoryName');
  private readonly categorySelect = viewChild.required<ElementRef<HTMLSelectElement>>('categorySelect');
  private readonly categoryTrigger = viewChild.required<ElementRef<HTMLButtonElement>>('categoryTrigger');
  protected readonly categoryOpen = signal(false);
  protected readonly categorySending = signal(false);
  protected readonly categoryErrors = signal<string[]>([]);
  protected readonly categoryNotice = signal('');
  protected readonly categoryForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    description: [''],
  });
  protected readonly options = signal<OptionsState>({ status: 'loading' });
  protected readonly sending = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    description: ['', [Validators.required, Validators.pattern(/\S/)]],
    amount: ['', [Validators.required, positiveAmount, maximumAmount]],
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
    this.categorySubscription?.unsubscribe();
    this.categoryOpen.set(false);
    this.categoryForm.reset();
    this.categoryErrors.set([]);
    this.categoryNotice.set('');
    this.loadSubscription?.unsubscribe();
    this.options.set({ status: 'loading' });
    this.errors.set([]);
    const id = this.expenseId;
    this.canEdit.set(false);
    if (id) this.form.reset();
    this.loadSubscription = forkJoin({
      categories: this.optionsService.categories(), households: this.optionsService.households(),
      expense: id ? this.expenses.get(id) : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ expense, ...options }) => {
        if (expense) {
          if (expense.can_edit !== true) {
            this.options.set({ status: 'denied' });
            this.errors.set(['No tenés permiso para editar este gasto.']);
            return;
          }
          this.canEdit.set(true);
          this.form.reset({
            description: expense.description, amount: expense.amount.replace('.', ','), date: expense.date,
            category_id: expense.category.id, household_id: expense.household?.id ?? null, notes: expense.notes ?? '',
          });
        }
        this.options.set({ status: 'loaded', ...options });
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) this.form.reset();
        this.options.set({ status: 'error' });
        this.errors.set(expenseErrors(error, 'No se pudieron cargar los datos. Verificá tu conexión e intentá nuevamente.'));
      },
    });
  }

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected openCategory(): void {
    if (this.sending() || this.categoryOpen() || this.options().status !== 'loaded') return;
    this.categoryNotice.set('');
    this.categoryOpen.set(true);
    this.changeDetector.detectChanges();
    this.categoryName().nativeElement.focus();
  }

  protected cancelCategory(): void {
    if (this.categorySending()) return;
    this.closeCategory();
    this.changeDetector.detectChanges();
    this.categoryTrigger().nativeElement.focus();
  }

  private closeCategory(): void {
    this.categoryOpen.set(false);
    this.categoryForm.reset();
    this.categoryErrors.set([]);
  }

  protected saveCategory(): void {
    if (!this.categoryOpen() || this.categorySending() || this.options().status !== 'loaded') return;
    this.categoryForm.markAllAsTouched();
    if (this.categoryForm.invalid) {
      this.categoryName().nativeElement.focus();
      return;
    }
    const { name, description } = this.categoryForm.getRawValue();
    this.categorySending.set(true);
    this.categoryErrors.set([]);
    this.categorySubscription = this.optionsService.createCategory({
      name: name.trim(), description: description.trim(),
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.categorySending.set(false))).subscribe({
      next: category => {
        this.options.update(state => state.status === 'loaded'
          ? { ...state, categories: [...state.categories, category] } : state);
        this.form.controls.category_id.setValue(category.id);
        this.form.controls.category_id.markAsDirty();
        this.closeCategory();
        this.categoryNotice.set(`Categoría «${category.name}» creada y seleccionada.`);
        this.categorySelect().nativeElement.focus();
      },
      error: (error: unknown) => {
        const fallback = error instanceof HttpErrorResponse && error.status === 401
          ? 'No se pudo autenticar tu sesión. Volvé a iniciar sesión para crear la categoría.'
          : error instanceof HttpErrorResponse && error.status === 0
            ? 'No se pudo conectar. Verificá tu conexión e intentá nuevamente.'
            : 'No se pudo crear la categoría. Intentá nuevamente.';
        this.categoryErrors.set(error instanceof HttpErrorResponse && error.status === 401
          ? [fallback] : expenseErrors(error, fallback));
      },
    });
  }

  protected submit(): void {
    if (this.sending() || this.categoryOpen() || (this.expenseId && this.canEdit() !== true)) return;
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
        if (this.expenseId && error instanceof HttpErrorResponse && error.status === 404) {
          this.canEdit.set(false);
          this.form.reset();
          this.closeCategory();
          this.categoryNotice.set('');
          this.options.set({ status: 'error' });
          this.heading().nativeElement.focus();
        }
        this.errors.set(expenseErrors(error, 'No se pudo guardar el gasto. Verificá tu conexión e intentá nuevamente.'));
      },
    });
  }
}
