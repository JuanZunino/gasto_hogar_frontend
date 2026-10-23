import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
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
  private readonly service = inject(ExpensesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly success = this.service.creationNotice();
  protected readonly state = signal<ExpensesState>({ status: 'loading' });

  ngOnInit(): void {
    this.service.creationNotice.set('');
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

  protected retry(): void {
    if (this.state().status === 'loading') return;
    this.heading().nativeElement.focus();
    this.load();
  }
}
