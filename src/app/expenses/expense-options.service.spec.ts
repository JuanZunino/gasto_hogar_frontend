import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from '../auth/auth.interceptor';
import { ExpenseOptionsService } from './expense-options.service';

describe('ExpenseOptionsService category creation', () => {
  let http: HttpTestingController;
  let service: ExpenseOptionsService;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('gastohogar.token', 'test-token');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ExpenseOptionsService);
  });

  afterEach(() => { http.verify(); sessionStorage.clear(); });

  it('posts the Rails envelope with Bearer authentication and returns the created option', () => {
    const category = { id: 12, name: 'Vacaciones', description: 'Gastos de viajes' };
    let result: unknown;
    service.createCategory({ name: category.name, description: category.description }).subscribe(value => result = value);
    const request = http.expectOne('/api/v1/categories');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.request.body).toEqual({ category: { name: 'Vacaciones', description: 'Gastos de viajes' } });
    request.flush(category, { status: 201, statusText: 'Created' });
    expect(result).toEqual(category);
  });
});
