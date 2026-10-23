import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ExpenseOptionsService, ExpenseOption } from './expense-options.service';
import { normalizeAmount, positiveAmount, validDate } from './expense-form.utils';
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

  ngOnInit(): void { this.loadOptions(); }
  ngAfterViewInit(): void { this.heading().nativeElement.focus(); }

  protected loadOptions(): void {
    this.options.set({ status: 'loading' });
    forkJoin({ categories: this.optionsService.categories(), households: this.optionsService.households() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (options) => this.options.set({ status: 'loaded', ...options }),
        error: () => this.options.set({ status: 'error' }),
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
    this.expenses.create({
      description: value.description.trim(), amount, date: value.date,
      category_id: value.category_id!, household_id: value.household_id,
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.sending.set(false))).subscribe({
      next: () => {
        this.expenses.creationNotice.set('Gasto creado correctamente.');
        void this.router.navigateByUrl('/gastos');
      },
      error: (error: unknown) => {
        const body: unknown = error instanceof HttpErrorResponse ? error.error : null;
        if (body && typeof body === 'object' && 'errors' in body && Array.isArray(body.errors) &&
          body.errors.length && body.errors.every((message: unknown) => typeof message === 'string')) {
          this.errors.set(body.errors);
        } else if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
          this.errors.set([body.error]);
        } else {
          this.errors.set(['No se pudo guardar el gasto. Verificá tu conexión e intentá nuevamente.']);
        }
      },
    });
  }
}
