import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';

export interface DashboardPeriod {
  from?: string;
  to?: string;
}

export interface CategoryExpenses {
  category: { id: number; name: string };
  total: string;
}

export interface DashboardSummary {
  total_expenses: string;
  expenses_count: number;
  expenses_by_category: CategoryExpenses[];
}

@Service()
export class DashboardService {
  private readonly http = inject(HttpClient);

  get(period: DashboardPeriod & { household_id?: string } = {}) {
    let params = new HttpParams();
    for (const key of ['from', 'to'] as const) {
      const value = period[key];
      if (value) params = params.set(key, value);
    }
    if (period.household_id && /^[1-9]\d*$/.test(period.household_id)) {
      params = params.set('household_id', period.household_id);
    }
    return this.http.get<DashboardSummary>('/api/v1/dashboard', { params });
  }
}
