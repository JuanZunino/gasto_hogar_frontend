import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { CreateExpense, Expense } from './expense';

@Service()
export class ExpensesService {
  private readonly http = inject(HttpClient);

  readonly notice = signal('');

  create(expense: CreateExpense) {
    return this.http.post<Expense>('/api/v1/expenses', expense);
  }

  get(id: string) {
    return this.http.get<Expense>(`/api/v1/expenses/${encodeURIComponent(id)}`);
  }

  update(id: string, expense: CreateExpense) {
    return this.http.patch<Expense>(`/api/v1/expenses/${encodeURIComponent(id)}`, expense);
  }

  delete(id: number) {
    return this.http.delete(`/api/v1/expenses/${id}`, { responseType: 'text' });
  }

  list() {
    return this.http.get<Expense[]>('/api/v1/expenses');
  }
}
