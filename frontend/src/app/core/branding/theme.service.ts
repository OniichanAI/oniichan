import { Injectable, computed, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'oni:theme';
const ATTR = 'data-theme';

/**
 * Manages the active theme. Three modes:
 *   - 'light' / 'dark' = explicit user choice (sticky in localStorage)
 *   - 'system'         = follows OS preference via @media prefers-color-scheme
 *
 * The service writes a data-theme attribute on <html>; styles.css picks it up.
 * Components observe `mode` and the computed `effective` signal (light|dark)
 * for things like swapping icon sets.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private modeSignal = signal<ThemeMode>(this.readInitial());
  private systemPrefersDark = signal<boolean>(this.detectSystemDark());

  mode = this.modeSignal.asReadonly();

  /** Concrete theme after collapsing 'system' against OS preference. */
  effective = computed<'light' | 'dark'>(() => {
    const m = this.modeSignal();
    if (m === 'system') return this.systemPrefersDark() ? 'dark' : 'light';
    return m;
  });

  constructor() {
    this.apply(this.modeSignal());
    this.subscribeToSystemPref();
  }

  set(mode: ThemeMode): void {
    this.modeSignal.set(mode);
    this.persist(mode);
    this.apply(mode);
  }

  /** Cycles light → dark → system → light. */
  toggle(): void {
    const next: ThemeMode =
      this.modeSignal() === 'light' ? 'dark' : this.modeSignal() === 'dark' ? 'system' : 'light';
    this.set(next);
  }

  private apply(mode: ThemeMode): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute(ATTR, mode);
  }

  private persist(mode: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* private-mode / quota — ignore */
    }
  }

  private readInitial(): ThemeMode {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    } catch {
      /* ignore */
    }
    return 'system';
  }

  private detectSystemDark(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private subscribeToSystemPref(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => this.systemPrefersDark.set(e.matches);
    // addEventListener is supported everywhere we care about; the older
    // addListener fallback isn't worth the runtime branch.
    mq.addEventListener('change', onChange);
  }
}
