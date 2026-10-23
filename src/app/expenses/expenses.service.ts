import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Expense } from './expense';

@Service()
export class ExpensesService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Expense[]>('/api/v1/expenses');
  }
}
