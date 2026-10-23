import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CategoryChart } from './category-chart';
import { DashboardIcon } from './dashboard-icon';

describe('CategoryChart', () => {
  it('compares exact decimal cents and keeps original values readable including zero', () => {
    const fixture = TestBed.createComponent(CategoryChart);
    const categories = [
      { category: { id: 1, name: 'Mayor' }, total: '900719925474099300.00' },
      { category: { id: 2, name: 'Mitad' }, total: '450359962737049650.00' },
      { category: { id: 3, name: 'Cero' }, total: '0.00' },
    ];
    fixture.componentRef.setInput('categories', categories);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const bars = element.querySelectorAll<HTMLElement>('.bar');
    expect([...bars].map(bar => bar.style.width)).toEqual(['100%', '50%', '0%']);
    expect(element.textContent).toContain('$\u00a0900.719.925.474.099.300,00');
    expect(element.textContent).toContain('$\u00a00,00');
    expect(categories[0].total).toBe('900719925474099300.00');
  });

  it('handles all-zero totals without dividing by zero and supports updates', () => {
    const fixture = TestBed.createComponent(CategoryChart);
    fixture.componentRef.setInput('categories', [{ category: { id: 1, name: 'Cero' }, total: '0.00' }]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLElement>('.bar')!.style.width).toBe('0%');
    expect(element.querySelectorAll('circle.segment')).toHaveLength(0);
    expect(element.querySelector('app-category-donut .percentage')!.textContent).toBe('0 %');
    fixture.componentRef.setInput('categories', []);
    fixture.detectChanges();
    expect(element.textContent).toContain('No hay datos de categorías');
  });
  it('renders consistent percentages, colors and exact amounts in bars and the donut legend', () => {
    const fixture = TestBed.createComponent(CategoryChart);
    fixture.componentRef.setInput('categories', [
      { category: { id: 91, name: 'Alimentos' }, total: '68500.00' },
      { category: { id: 92, name: 'Servicios' }, total: '38000.00' },
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const bars = element.querySelectorAll('.bars li');
    const legend = element.querySelectorAll('app-category-donut li');
    const segments = element.querySelectorAll('circle.segment');
    expect(segments).toHaveLength(2);
    for (let index = 0; index < bars.length; index++) {
      expect(legend[index].querySelector('.percentage')!.textContent)
        .toBe(bars[index].querySelector('.percentage')!.textContent);
      expect(legend[index].querySelector('strong')!.textContent)
        .toBe(bars[index].querySelector('strong')!.textContent);
      expect(legend[index].querySelector<HTMLElement>('.legend-icon')!.style.backgroundColor)
        .toBe(bars[index].querySelector<HTMLElement>('.bar')!.style.backgroundColor);
    }
    expect(segments[0].getAttribute('stroke')).not.toBe(segments[1].getAttribute('stroke'));
    expect(segments[0].getAttribute('stroke-dasharray')).toContain('64.319248');
    expect(element.textContent).toContain('porcentaje aproximado');
    expect(element.querySelector('app-category-donut svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('app-category-donut ul')!.getAttribute('aria-label')).toContain('nombre, porcentaje e importe');
    const icons = fixture.debugElement.queryAll(By.directive(DashboardIcon));
    expect(icons.map(icon => icon.injector.get(DashboardIcon).name())).toEqual(['cart', 'house', 'cart', 'house']);
  });

  it('renders unknown external names as text and a generic icon, without injecting markup', () => {
    const fixture = TestBed.createComponent(CategoryChart);
    fixture.componentRef.setInput('categories', [
      { category: { id: 1, name: '<img src=x onerror=alert(1)>' }, total: '10.01' },
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(fixture.debugElement.query(By.directive(DashboardIcon)).injector.get(DashboardIcon).name()).toBe('category');
    expect(element.querySelector('app-category-donut .percentage')!.textContent).toBe('100 %');
  });

});
