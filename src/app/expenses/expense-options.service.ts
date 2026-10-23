import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';

export interface ExpenseOption {
  id: number;
  name: string;
  description: string | null;
}

@Service()
export class ExpenseOptionsService {
  private readonly http = inject(HttpClient);

  categories() { return this.http.get<ExpenseOption[]>('/api/v1/categories'); }
  households() { return this.http.get<ExpenseOption[]>('/api/v1/households'); }
}
