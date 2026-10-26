import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../auth/auth.interceptor';
import { normalizeAmount, validDate } from './expense-form.utils';

const category = { id: 2, name: 'Alimentos', description: null };
const household = { id: 1, name: 'Casa', description: null };
const created = {
  id: 10, description: 'Supermercado', amount: '18500.50', date: '2026-10-21', notes: null,
  receipt_attached: false, category, household: null,
  author: { id: 1, name: 'Ana' }, can_edit: true, can_delete: true,
};

describe('New expense', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('gastohogar.token', 'test-token');
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); sessionStorage.clear(); });

  function loadOptions(): void {
    const categories = http.expectOne('/api/v1/categories');
    expect(categories.request.headers.get('Authorization')).toBe('Bearer test-token');
    categories.flush([category]);
    http.expectOne('/api/v1/households').flush([household]);
  }

  function form(harness: RouterTestingHarness) {
    return harness.routeDebugElement!.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective).form;
  }

  function fill(harness: RouterTestingHarness): void {
    form(harness).patchValue({ description: 'Supermercado', amount: '18500,50', date: '2026-10-21', category_id: 2 });
    harness.detectChanges();
  }

  function submit(harness: RouterTestingHarness): void {
    harness.routeNativeElement!.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    harness.detectChanges();
  }

  function categoryForm(harness: RouterTestingHarness) {
    return harness.routeDebugElement!.queryAll(By.directive(FormGroupDirective))[1].injector.get(FormGroupDirective).form;
  }

  function openCategory(harness: RouterTestingHarness): void {
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.new-category')!.click();
    harness.detectChanges();
  }

  function saveCategory(harness: RouterTestingHarness): void {
    harness.routeNativeElement!.querySelector('#new-category-panel form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    harness.detectChanges();
  }

  it('opens and cancels an independent accessible category form without changing the expense', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); fill(harness);
    const before = form(harness).getRawValue();
    openCategory(harness);
    const element = harness.routeNativeElement!;
    expect(document.activeElement).toBe(element.querySelector('#category-name'));
    expect(element.querySelectorAll('form form')).toHaveLength(0);
    expect(element.querySelector<HTMLInputElement>('#category-name')!.labels![0].htmlFor).toBe('category-name');
    expect(element.querySelector<HTMLTextAreaElement>('#category-description')!.labels![0].htmlFor).toBe('category-description');
    expect(element.querySelector<HTMLButtonElement>('.expense-form button[type="submit"]')!.disabled).toBe(true);
    categoryForm(harness).patchValue({ name: 'Temporal', description: 'Borrador' });
    submit(harness);
    http.expectNone('/api/v1/expenses');
    element.querySelector<HTMLButtonElement>('#new-category-panel button[type="button"]')!.click();
    harness.detectChanges();
    expect(form(harness).getRawValue()).toEqual(before);
    expect(categoryForm(harness).getRawValue()).toEqual({ name: '', description: '' });
    expect(element.querySelector<HTMLElement>('#new-category-panel')!.hidden).toBe(true);
    expect(document.activeElement).toBe(element.querySelector('.new-category'));
    http.expectNone('/api/v1/categories');
  });

  it.each(['', '   '])('rejects a category name %j without posting', async name => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); harness.detectChanges(); openCategory(harness);
    categoryForm(harness).patchValue({ name }); saveCategory(harness);
    expect(harness.routeNativeElement!.querySelector('#category-name-error')!.textContent).toContain('Ingresá un nombre');
    http.expectNone('/api/v1/categories');
  });

  it('creates and selects a category, trims input, preserves all expense fields and prevents duplicate POSTs', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); fill(harness);
    form(harness).patchValue({ household_id: 1, notes: 'Pendiente' });
    const before = form(harness).getRawValue();
    openCategory(harness);
    categoryForm(harness).patchValue({ name: '  Vacaciones  ', description: '  Viajes  ' });
    saveCategory(harness);
    const request = http.expectOne('/api/v1/categories');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.request.body).toEqual({ category: { name: 'Vacaciones', description: 'Viajes' } });
    saveCategory(harness); submit(harness);
    http.expectNone('/api/v1/categories'); http.expectNone('/api/v1/expenses');
    request.flush({ id: 12, name: 'Vacaciones', description: 'Viajes' }, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(form(harness).getRawValue()).toEqual({ ...before, category_id: 12 });
    const element = harness.routeNativeElement!;
    const select = element.querySelector<HTMLSelectElement>('#category')!;
    expect(select.selectedOptions[0].textContent).toContain('Vacaciones');
    expect(document.activeElement).toBe(select);
    expect(element.querySelector<HTMLElement>('#new-category-panel')!.hidden).toBe(true);
    expect(categoryForm(harness).getRawValue()).toEqual({ name: '', description: '' });
    expect(element.textContent).toContain('creada y seleccionada');
    http.expectNone('/api/v1/categories'); http.expectNone('/api/v1/households');
    submit(harness);
    const expenseRequest = http.expectOne('/api/v1/expenses');
    expect(expenseRequest.request.body.category_id).toBe(12);
    expenseRequest.flush({ errors: ['Prueba'] }, { status: 422, statusText: 'Unprocessable Entity' });
  });

  it.each([
    { status: 422, body: { errors: ['Nombre ya utilizado'] }, message: 'Nombre ya utilizado' },
    { status: 401, body: {}, message: 'No se pudo autenticar' },
    { status: 500, body: {}, message: 'No se pudo crear la categoría' },
    { status: 0, body: null, message: 'Verificá tu conexión' },
  ])('retains category and expense values and allows retry after status $status', async ({ status, body, message }) => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); fill(harness); openCategory(harness);
    const before = form(harness).getRawValue();
    categoryForm(harness).patchValue({ name: 'Vacaciones', description: 'Viajes' });
    saveCategory(harness);
    const request = http.expectOne('/api/v1/categories');
    if (status === 0) request.error(new ProgressEvent('error'));
    else request.flush(body, { status, statusText: 'Error' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('#new-category-panel [role="alert"]')!.textContent).toContain(message);
    expect(harness.routeNativeElement!.querySelector<HTMLElement>('#new-category-panel')!.hidden).toBe(false);
    expect(categoryForm(harness).getRawValue()).toEqual({ name: 'Vacaciones', description: 'Viajes' });
    expect(form(harness).getRawValue()).toEqual(before);
    saveCategory(harness);
    http.expectOne('/api/v1/categories').flush({ id: 12, name: 'Vacaciones', description: 'Viajes' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('#new-category-panel [role="alert"]')).toBeNull();
  });

  it('can create the first category with an empty optional description', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    harness.detectChanges(); openCategory(harness);
    categoryForm(harness).patchValue({ name: 'Primera' }); saveCategory(harness);
    const request = http.expectOne('/api/v1/categories');
    expect(request.request.body).toEqual({ category: { name: 'Primera', description: '' } });
    request.flush({ id: 12, name: 'Primera', description: null });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(form(harness).get('category_id')!.value).toBe(12);
    expect(harness.routeNativeElement!.textContent).not.toContain('No hay categorías disponibles');
  });

  it('cancels the pending category request when the component is destroyed', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); harness.detectChanges(); openCategory(harness);
    categoryForm(harness).patchValue({ name: 'Vacaciones' }); saveCategory(harness);
    const request = http.expectOne('/api/v1/categories');
    await harness.navigateByUrl('/login');
    expect(request.cancelled).toBe(true);
  });

  it('presents the shared creation card with existing fields, visible labels and associated help/errors', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); await harness.fixture.whenStable(); harness.detectChanges();
    const element = harness.routeNativeElement!;
    expect(element.querySelector('h1')!.textContent).toBe('Nuevo gasto');
    expect(document.activeElement).toBe(element.querySelector('h1'));
    expect(element.querySelector('button[type="submit"]')!.textContent).toBe('Guardar gasto');
    expect(element.querySelector('.cancel')!.textContent).toBe('Cancelar');
    expect(element.querySelector('.cancel')!.getAttribute('href')).toBe('/gastos');
    expect(element.querySelectorAll('.form-grid .field')).toHaveLength(6);
    for (const id of ['description', 'amount', 'date', 'category', 'household', 'notes']) {
      const control = element.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('#' + id)!;
      expect(control.labels![0].getAttribute('for')).toBe(id);
      for (const reference of (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)) {
        expect(element.querySelector('#' + reference)).not.toBeNull();
      }
    }
    expect(element.querySelector<HTMLInputElement>('#amount')!.inputMode).toBe('decimal');
    expect(element.querySelector('#household')!.textContent).toContain('Personal (sin hogar)');
    submit(harness);
    expect(element.querySelector('#amount-error')!.textContent).toContain('Ingresá un importe positivo');
    expect(element.querySelector('#amount')!.getAttribute('aria-invalid')).toBe('true');
    http.expectNone('/api/v1/expenses');
  });

  it('creates a personal expense with flat JSON and shows success on the refreshed list', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions();
    fill(harness);
    expect(harness.routeNativeElement!.textContent).toContain('Personal (sin hogar)');
    submit(harness);
    const request = http.expectOne('/api/v1/expenses');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.request.body).toEqual({
      description: 'Supermercado', amount: '18500.50', date: '2026-10-21', category_id: 2, household_id: null,
    });
    expect(harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    submit(harness);
    http.expectNone('/api/v1/expenses');
    request.flush(created, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    const list = http.expectOne('/api/v1/expenses');
    expect(list.request.method).toBe('GET');
    list.flush([created]);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Gasto creado correctamente.');
    expect(harness.routeNativeElement!.querySelector('[role="status"]')!.textContent).toContain('Gasto creado');
    expect(harness.routeNativeElement!.textContent).toContain('Supermercado');
  });

  it('sends a selected household and optional notes without losing amount precision', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions();
    fill(harness);
    form(harness).patchValue({ household_id: 1, notes: 'Compra semanal', amount: '9.007.199.254.740.993,01' });
    submit(harness);
    const request = http.expectOne('/api/v1/expenses');
    expect(request.request.body.amount).toBe('9007199254740993.01');
    expect(request.request.body.household_id).toBe(1);
    expect(request.request.body.notes).toBe('Compra semanal');
    request.flush({ errors: ['Prueba de validación'] }, { status: 422, statusText: 'Unprocessable Entity' });
  });

  it('validates required fields, positive amounts and real calendar dates before posting', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions();
    submit(harness);
    expect(harness.routeNativeElement!.textContent).toContain('Ingresá una descripción.');
    expect(harness.routeNativeElement!.textContent).toContain('Seleccioná una categoría.');
    expect(harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    fill(harness);
    form(harness).patchValue({ amount: '0,00', date: '2026-02-30' });
    submit(harness);
    expect(harness.routeNativeElement!.textContent).toContain('Ingresá un importe positivo');
    expect(harness.routeNativeElement!.textContent).toContain('Ingresá una fecha válida.');
    http.expectNone('/api/v1/expenses');
  });

  it('displays Rails 422 errors, retains values and enables retrying', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); fill(harness); submit(harness);
    http.expectOne('/api/v1/expenses').flush({ errors: ['La categoría no está disponible', 'El importe supera el límite'] },
      { status: 422, statusText: 'Unprocessable Entity' });
    await harness.fixture.whenStable(); harness.detectChanges();
    const alert = harness.routeNativeElement!.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('La categoría no está disponible');
    expect(alert.textContent).toContain('El importe supera el límite');
    expect(form(harness).get('description')!.value).toBe('Supermercado');
    expect(harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/gastos/nuevo');
  });

  it('displays the Rails authentication error', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); fill(harness); submit(harness);
    http.expectOne('/api/v1/expenses').flush({ error: 'Sesión expirada' }, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain('Sesión expirada');
  });

  it('blocks saving while options load or fail, and retries their real endpoints', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    fill(harness); submit(harness); http.expectNone('/api/v1/expenses');
    const categories = http.expectOne('/api/v1/categories');
    http.expectOne('/api/v1/households').flush([household]);
    categories.flush({}, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain('No se pudieron cargar');
    submit(harness); http.expectNone('/api/v1/expenses');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button')!.click();
    loadOptions();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('blocks saving if there are no categories', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    fill(harness); submit(harness);
    expect(harness.routeNativeElement!.textContent).toContain('No hay categorías disponibles');
    http.expectNone('/api/v1/expenses');
  });

  it('cancels back to the list without a POST', async () => {
    const harness = await RouterTestingHarness.create('/gastos/nuevo');
    loadOptions(); harness.detectChanges();
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    const request = http.expectOne('/api/v1/expenses');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('protects the creation route without a token', async () => {
    sessionStorage.clear();
    await RouterTestingHarness.create('/gastos/nuevo');
    expect(TestBed.inject(Router).url).toBe('/login');
    http.expectNone('/api/v1/categories');
  });
});

describe('Expense form input validation', () => {
  it('normalizes Argentine amounts exactly and rejects invalid or nonpositive input', () => {
    expect(normalizeAmount('18500,50')).toBe('18500.50');
    expect(normalizeAmount('18.500,50')).toBe('18500.50');
    expect(normalizeAmount('0,01')).toBe('0.01');
    expect(normalizeAmount(' 0018,5 ')).toBe('18.50');
    expect(normalizeAmount('9007199254740993,01')).toBe('9007199254740993.01');
    for (const value of ['', '0', '-1', '1,234', '18.50', '1e3', '1.00,50', 'NaN']) {
      expect(normalizeAmount(value)).toBeNull();
    }
  });

  it('validates dates including leap years', () => {
    expect(validDate(new FormControl('2024-02-29', { nonNullable: true }))).toBeNull();
    for (const value of ['2026-02-29', '2026-04-31', '0000-01-01', 'invalid']) {
      expect(validDate(new FormControl(value, { nonNullable: true }))).toEqual({ date: true });
    }
  });
});
