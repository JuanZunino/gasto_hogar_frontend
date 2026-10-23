import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../auth/auth.interceptor';
import { ArsAmountPipe } from './ars-amount.pipe';
import { Expense } from './expense';
import { ExpensesService } from './expenses.service';

const expenses: Expense[] = [
  {
    id: 10, description: 'Supermercado', amount: '45000.00', date: '2026-10-21',
    notes: null, receipt_attached: false, category: { id: 2, name: 'Alimentos' }, household: null,
  },
  {
    id: 9, description: 'Electricidad', amount: '1234.56', date: '2026-10-20',
    notes: 'Factura', receipt_attached: true, category: { id: 3, name: 'Servicios' },
    household: { id: 1, name: 'Casa' },
  },
];

describe('Expenses', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('gastohogar.token', 'test-token');
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('preserves decimal strings in the service response', () => {
    const precise = { ...expenses[0], amount: '9007199254740993.01' };
    TestBed.inject(ExpensesService).list().subscribe(result => {
      expect(result).toEqual([precise]);
      expect(result[0].amount).toBe('9007199254740993.01');
    });
    const request = http.expectOne('/api/v1/expenses');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([precise]);
  });

  it('shows loading and then expenses in API order with ARS, date, category and household', async () => {
    const harness = await RouterTestingHarness.create('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    expect(harness.routeNativeElement!.textContent).toContain('Cargando gastos');
    expect(harness.routeNativeElement!.querySelector('.retry-list')).toBeNull();
    const request = http.expectOne('/api/v1/expenses');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush(expenses);
    await harness.fixture.whenStable();
    harness.detectChanges();
    const items = harness.routeNativeElement!.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Supermercado');
    expect(items[0].textContent).toContain('21/10/2026');
    expect(items[0].textContent).toContain('Alimentos');
    expect(items[0].textContent).toContain('$\u00a045.000,00');
    expect(items[0].textContent).toContain('Personal');
    expect(items[1].textContent).toContain('Electricidad');
    expect(items[1].textContent).toContain('$\u00a01.234,56');
    expect(items[1].textContent).toContain('Casa');
    expect(harness.routeNativeElement!.textContent).not.toContain('Cargando gastos');
    expect(harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a')!.getAttribute('href')).toBe('/inicio');
  });

  it('shows the empty state', async () => {
    const harness = await RouterTestingHarness.create('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush([]);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Todavía no tenés gastos registrados.');
    expect(harness.routeNativeElement!.querySelector('ul')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows an API error and retries successfully', async () => {
    const harness = await RouterTestingHarness.create('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush({}, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent)
      .toContain('No se pudieron cargar tus gastos');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.retry-list')!.click();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Cargando gastos');
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('.retry-list')).toBeNull();
    http.expectOne('/api/v1/expenses').flush(expenses);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelectorAll('li').length).toBe(2);
  });

  it('shows a connection error', async () => {
    const harness = await RouterTestingHarness.create('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').error(new ProgressEvent('error'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent)
      .toContain('Verificá tu conexión');
    expect(harness.routeNativeElement!.querySelector('.retry-list')!.textContent).toContain('Reintentar');
  });

  it('protects the route without a session', async () => {
    sessionStorage.clear();
    await RouterTestingHarness.create('/gastos');
    expect(TestBed.inject(Router).url).toBe('/login');
    http.expectNone('/api/v1/expenses');
  });

  it('navigates from home while preserving the profile request', async () => {
    const harness = await RouterTestingHarness.create('/inicio');
    http.expectOne('/api/v1/profile').flush({ id: 1, name: 'Ana', email: 'ana@example.com', role: 'member' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Ana');
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[href="/gastos"]')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush([]);
  });
});

describe('ArsAmountPipe', () => {
  it('formats Argentine pesos without floating point conversion or rounding', () => {
    const pipe = new ArsAmountPipe();
    expect(pipe.transform('45000.00')).toBe('$\u00a045.000,00');
    expect(pipe.transform('9007199254740993.01')).toBe('$\u00a09.007.199.254.740.993,01');
    expect(pipe.transform('0.10')).toBe('$\u00a00,10');
    expect(pipe.transform('-1234.56')).toBe('$\u00a0-1.234,56');
  });
});
