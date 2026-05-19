import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  it('defaults to system mode on first run', () => {
    const svc = TestBed.inject(ThemeService);
    expect(svc.mode()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
  });

  it('round-trips an explicit choice through localStorage', () => {
    TestBed.inject(ThemeService).set('dark');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const next = TestBed.inject(ThemeService);
    expect(next.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggle cycles light → dark → system → light', () => {
    const svc = TestBed.inject(ThemeService);
    svc.set('light');
    svc.toggle();
    expect(svc.mode()).toBe('dark');
    svc.toggle();
    expect(svc.mode()).toBe('system');
    svc.toggle();
    expect(svc.mode()).toBe('light');
  });
});
