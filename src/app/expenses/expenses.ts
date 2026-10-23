import { DatePipe } from '@angular/common';
import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { expenseErrors } from './expense-errors';
import { ArsAmountPipe } from './ars-amount.pipe';
import { Expense } from './expense';
import { ExpensesService } from './expenses.service';

type ExpensesState =
  | { status: 'loading' }
  | { status: 'loaded'; expenses: Expense[] }
  | { status: 'error' };

@Component({
  selector: 'app-expenses',
  imports: [RouterLink, DatePipe, ArsAmountPipe],
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

  ngOnInit(): void {
    this.service.notice.set('');
    this.load();
  }

  ngAfterViewInit(): void {
    this.heading().nativeElement.focus();
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (expenses) => this.state.set({ status: 'loaded', expenses }),
      error: () => this.state.set({ status: 'error' }),
    });
  }

  protected confirmDelete(expense: Expense): void {
    if (this.deleting()) return;
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
    if (!expense || this.deleting()) return;
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
        this.deleteErrors.set(expenseErrors(error, 'No se pudo eliminar el gasto. Verificá tu conexión e intentá nuevamente.'));
      },
    });
  }

  protected retry(): void {
    if (this.state().status === 'loading') return;
    this.heading().nativeElement.focus();
    this.load();
  }
}
