import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { CreateExpense, Expense } from './expense';

export interface ExpenseFilters {
  from?: string;
  to?: string;
  category_id?: string;
  household_id?: string;
}

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

  list(filters: ExpenseFilters = {}) {
    let params = new HttpParams();
    for (const key of ['from', 'to', 'category_id', 'household_id'] as const) {
      const value = filters[key];
      if (value) params = params.set(key, value);
    }
    return this.http.get<Expense[]>('/api/v1/expenses', { params });
  }
}
