import { TestBed } from '@angular/core/testing';
import { CategoryChart } from './category-chart';

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
    fixture.componentRef.setInput('categories', []);
    fixture.detectChanges();
    expect(element.textContent).toContain('No hay datos de categorías');
  });
});
