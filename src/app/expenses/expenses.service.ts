import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { CreateExpense, Expense } from './expense';

@Service()
export class ExpensesService {
  private readonly http = inject(HttpClient);

  readonly creationNotice = signal('');

  create(expense: CreateExpense) {
    return this.http.post<Expense>('/api/v1/expenses', expense);
  }

  list() {
    return this.http.get<Expense[]>('/api/v1/expenses');
  }
}
