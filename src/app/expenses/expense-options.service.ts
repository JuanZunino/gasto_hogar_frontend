import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';

export interface ExpenseOption {
  id: number;
  name: string;
  description: string | null;
}

export interface CreateCategory {
  name: string;
  description: string;
}

@Service()
export class ExpenseOptionsService {
  private readonly http = inject(HttpClient);

  categories() { return this.http.get<ExpenseOption[]>('/api/v1/categories'); }
  createCategory(category: CreateCategory) {
    return this.http.post<ExpenseOption>('/api/v1/categories', { category });
  }

  households() { return this.http.get<ExpenseOption[]>('/api/v1/households'); }
}
