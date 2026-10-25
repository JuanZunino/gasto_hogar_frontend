import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../auth/auth.interceptor';
import { Expense } from './expense';

const expense: Expense = {
  id: 10, description: 'Supermercado', amount: '9007199254740993.50', date: '2026-10-21', notes: 'Compra',
  receipt_attached: false, category: { id: 2, name: 'Alimentos' }, household: { id: 1, name: 'Casa' },
};

describe('Edit and delete expenses', () => {
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

  function options(): void {
    http.expectOne('/api/v1/categories').flush([{ ...expense.category, description: null }]);
    http.expectOne('/api/v1/households').flush([{ ...expense.household, description: null }]);
  }

  function form(harness: RouterTestingHarness) {
    return harness.routeDebugElement!.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective).form;
  }

  function submit(harness: RouterTestingHarness): void {
    harness.routeNativeElement!.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    harness.detectChanges();
  }

  function click(harness: RouterTestingHarness, text: string): void {
    const buttons = [...harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('button')];
    const button = buttons.find(item => item.textContent?.trim() === text);
    expect(button).toBeDefined();
    button!.click(); harness.detectChanges();
  }

  async function list(): Promise<RouterTestingHarness> {
    const harness = await RouterTestingHarness.create('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush([expense]);
    await harness.fixture.whenStable(); harness.detectChanges();
    return harness;
  }

  it('uses the same form for editing with distinct heading, save label and cancellation navigation', async () => {
    const harness = await RouterTestingHarness.create('/gastos/10/editar');
    options(); http.expectOne('/api/v1/expenses/10').flush(expense);
    await harness.fixture.whenStable(); harness.detectChanges();
    const element = harness.routeNativeElement!;
    expect(element.querySelector('h1')!.textContent).toBe('Editar gasto');
    expect(element.querySelector('.intro')!.textContent).toContain('guardá los cambios');
    expect(element.querySelector('button[type="submit"]')!.textContent).toBe('Guardar cambios');
    expect(element.querySelectorAll('form.expense-form')).toHaveLength(1);
    expect(element.querySelector<HTMLElement>('#new-category-panel')!.hidden).toBe(true);
    expect(element.querySelector<HTMLInputElement>('#amount')!.value).toBe('9007199254740993,50');
    element.querySelector<HTMLAnchorElement>('.cancel')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush([]);
    http.expectNone(request => request.method === 'PATCH' || request.method === 'POST');
  });

  it('creates a category while editing without reloading or losing unsaved changes', async () => {
    const harness = await RouterTestingHarness.create('/gastos/10/editar');
    options(); http.expectOne('/api/v1/expenses/10').flush(expense);
    await harness.fixture.whenStable(); harness.detectChanges();
    form(harness).patchValue({ description: 'Compra pendiente', notes: 'Sin guardar', household_id: null });
    const before = form(harness).getRawValue();
    click(harness, 'Nueva categoría');
    const categoryForm = harness.routeDebugElement!.queryAll(By.directive(FormGroupDirective))[1].injector.get(FormGroupDirective).form;
    categoryForm.patchValue({ name: 'Vacaciones', description: 'Viajes' });
    harness.routeNativeElement!.querySelector('#new-category-panel form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne('/api/v1/categories').flush({ id: 12, name: 'Vacaciones', description: 'Viajes' }, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(form(harness).getRawValue()).toEqual({ ...before, category_id: 12 });
    http.expectNone('/api/v1/categories'); http.expectNone('/api/v1/households');
    http.expectNone('/api/v1/expenses/10');
    click(harness, 'Nueva categoría');
    categoryForm.patchValue({ name: 'Descartar' });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('#new-category-panel button[type="button"]')!.click();
    harness.detectChanges();
    expect(form(harness).getRawValue()).toEqual({ ...before, category_id: 12 });
    submit(harness);
    const patch = http.expectOne('/api/v1/expenses/10');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ ...before, amount: expense.amount, category_id: 12 });
    patch.flush({ errors: ['Prueba'] }, { status: 422, statusText: 'Unprocessable Entity' });
  });

  it('preloads all fields and updates using only permitted fields without losing precision', async () => {
    const harness = await RouterTestingHarness.create('/gastos/10/editar');
    expect(harness.routeNativeElement!.textContent).toContain('Cargando datos');
    options();
    const get = http.expectOne('/api/v1/expenses/10');
    expect(get.request.method).toBe('GET');
    expect(get.request.headers.get('Authorization')).toBe('Bearer test-token');
    get.flush(expense);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(form(harness).getRawValue()).toEqual({
      description: expense.description, amount: '9007199254740993,50', date: expense.date,
      category_id: 2, household_id: 1, notes: 'Compra',
    });
    form(harness).patchValue({ description: 'Compra actualizada', household_id: null, notes: '' });
    submit(harness);
    const patch = http.expectOne('/api/v1/expenses/10');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(patch.request.body).toEqual({
      description: 'Compra actualizada', amount: '9007199254740993.50', date: expense.date,
      category_id: 2, household_id: null, notes: '',
    });
    expect(harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    submit(harness); http.expectNone('/api/v1/expenses/10');
    patch.flush({ ...expense, description: 'Compra actualizada', household: null, notes: null });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush([{ ...expense, description: 'Compra actualizada' }]);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Gasto actualizado correctamente.');
  });

  it('retains edited fields and displays Rails 422 errors', async () => {
    const harness = await RouterTestingHarness.create('/gastos/10/editar');
    options(); http.expectOne('/api/v1/expenses/10').flush(expense);
    await harness.fixture.whenStable();
    form(harness).patchValue({ description: 'Otra compra' }); submit(harness);
    http.expectOne('/api/v1/expenses/10').flush({ errors: ['Importe fuera de rango'] }, { status: 422, statusText: 'Unprocessable Entity' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain('Importe fuera de rango');
    expect(form(harness).get('description')!.value).toBe('Otra compra');
    expect(harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('displays 404 when loading and blocks saving until a successful retry', async () => {
    const harness = await RouterTestingHarness.create('/gastos/10/editar');
    options();
    http.expectOne('/api/v1/expenses/10').flush({ errors: ['Gasto no encontrado.'] }, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Gasto no encontrado.');
    expect(harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    submit(harness); http.expectNone('/api/v1/expenses/10');
    click(harness, 'Reintentar carga');
    options(); http.expectOne('/api/v1/expenses/10').flush(expense);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(form(harness).get('description')!.value).toBe('Supermercado');
  });

  it('displays a 404 returned while updating', async () => {
    const harness = await RouterTestingHarness.create('/gastos/10/editar');
    options(); http.expectOne('/api/v1/expenses/10').flush(expense);
    await harness.fixture.whenStable(); submit(harness);
    http.expectOne('/api/v1/expenses/10').flush({ errors: ['Gasto no encontrado.'] }, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Gasto no encontrado.');
    expect(TestBed.inject(Router).url).toBe('/gastos/10/editar');
  });

  it('shows network failures when saving and keeps the form available', async () => {
    const harness = await RouterTestingHarness.create('/gastos/10/editar');
    options(); http.expectOne('/api/v1/expenses/10').flush(expense);
    await harness.fixture.whenStable(); submit(harness);
    http.expectOne('/api/v1/expenses/10').error(new ProgressEvent('error'));
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Verificá tu conexión');
    expect(form(harness).get('amount')!.value).toBe('9007199254740993,50');
  });

  it('reloads the expense when navigating between edit IDs', async () => {
    const harness = await RouterTestingHarness.create('/gastos/10/editar');
    options(); http.expectOne('/api/v1/expenses/10').flush(expense);
    await harness.fixture.whenStable();
    await harness.navigateByUrl('/gastos/11/editar');
    options(); http.expectOne('/api/v1/expenses/11').flush({ ...expense, id: 11, description: 'Otro gasto' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(form(harness).get('description')!.value).toBe('Otro gasto');
  });

  it('protects the edit route without a session', async () => {
    sessionStorage.clear();
    await RouterTestingHarness.create('/gastos/10/editar');
    expect(TestBed.inject(Router).url).toBe('/login');
    http.expectNone('/api/v1/expenses/10');
  });

  it('only sends DELETE after confirmation, accepts 204 and removes the item', async () => {
    const harness = await list();
    expect(harness.routeNativeElement!.querySelector('a[href="/gastos/10/editar"]')).not.toBeNull();
    click(harness, 'Eliminar'); http.expectNone('/api/v1/expenses/10');
    expect(harness.routeNativeElement!.querySelector('h3')!.textContent).toContain('Supermercado');
    click(harness, 'Confirmar eliminación');
    const request = http.expectOne('/api/v1/expenses/10');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.responseType).toBe('text');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect([...harness.routeNativeElement!.querySelectorAll('button')].every(button => button.matches(':disabled'))).toBe(true);
    click(harness, 'Confirmar eliminación'); http.expectNone('/api/v1/expenses/10');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('article')).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('eliminado correctamente');
    expect(harness.routeNativeElement!.textContent).toContain('Todavía no tenés gastos');
  });

  it('cancels deletion without sending an HTTP request', async () => {
    const harness = await list();
    click(harness, 'Eliminar'); click(harness, 'Cancelar eliminación');
    http.expectNone('/api/v1/expenses/10');
    expect(harness.routeNativeElement!.querySelector('article')!.textContent).toContain('Supermercado');
    expect(harness.routeNativeElement!.querySelector('h3')).toBeNull();
  });

  it('keeps the expense after a deletion error and requires an explicit retry', async () => {
    const harness = await list();
    click(harness, 'Eliminar'); click(harness, 'Confirmar eliminación');
    http.expectOne('/api/v1/expenses/10').flush({ errors: ['No se pudo eliminar.'] }, { status: 422, statusText: 'Unprocessable Entity' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain('No se pudo eliminar.');
    expect(harness.routeNativeElement!.querySelector('article')!.textContent).toContain('Supermercado');
    http.expectNone('/api/v1/expenses/10');
    click(harness, 'Reintentar eliminación');
    http.expectOne('/api/v1/expenses/10').flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('article')).toBeNull();
  });
});
