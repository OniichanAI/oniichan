import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

const STORAGE_KEY = 'oni:sidebar-collapsed';

/**
 * Owns the two independent pieces of sidebar UI state:
 *
 *   - `collapsed`   — user preference on desktop (≥ lg). Persisted to
 *                     localStorage so it survives reloads. Means the sidebar
 *                     shrinks to a 64px icon rail.
 *   - `mobileOpen`  — ephemeral overlay state on mobile (< lg). Resets on
 *                     every route navigation so a new page never inherits
 *                     a stale open drawer.
 *
 * Both states are read by the app shell + sidebar; they're orthogonal —
 * the desktop preference is irrelevant on mobile and vice versa.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private router = inject(Router);

  private collapsedSignal = signal<boolean>(this.readPersisted());
  private mobileOpenSignal = signal<boolean>(false);

  collapsed = this.collapsedSignal.asReadonly();
  mobileOpen = this.mobileOpenSignal.asReadonly();

  constructor() {
    // Auto-close the mobile drawer on every navigation. Without this,
    // tapping a nav link opens the next page *behind* a still-open
    // backdrop — confusing UX.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.mobileOpenSignal.set(false));
  }

  toggleCollapsed(): void {
    this.collapsedSignal.update((v) => !v);
    this.persist(this.collapsedSignal());
  }

  toggleMobile(): void {
    this.mobileOpenSignal.update((v) => !v);
  }

  closeMobile(): void {
    this.mobileOpenSignal.set(false);
  }

  private readPersisted(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private persist(value: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* private mode / quota — ignore */
    }
  }
}
