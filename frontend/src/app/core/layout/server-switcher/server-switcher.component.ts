import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TenantService } from '../../stores/tenant.service';
import { SettingsService } from '../../stores/settings.service';
import { Tenant } from '../../http/tenant.model';
import { OniIconComponent } from '../../branding/oni-icon.component';

/**
 * Top-bar tenant chip + dropdown. Lists every tenant the user belongs to,
 * lets them switch inline (no full route navigation, just swap the
 * TenantService current + reload settings), and exposes a way back to
 * /onboarding for installing a new server.
 *
 * Closes on outside click, Escape, or after a selection.
 */
@Component({
  selector: 'oni-server-switcher',
  standalone: true,
  imports: [CommonModule, OniIconComponent],
  styles: [':host { display: inline-flex; position: relative; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="toggle()"
      [attr.aria-expanded]="open()"
      aria-haspopup="menu"
      class="flex min-w-0 max-w-[14rem] items-center gap-2.5 rounded-2xl border border-transparent px-2 py-1 transition hover:border-oni-border hover:bg-oni-surface-mute sm:max-w-none"
    >
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-oni-primary-soft text-sm font-bold text-oni-primary-deep"
      >
        {{ initial() }}
      </span>
      <!-- Text block hidden on the very smallest screens — the avatar + dropdown
           caret are enough to identify + tap. Re-appears at sm. -->
      <span class="hidden min-w-0 flex-col items-start leading-tight sm:flex">
        <span class="max-w-[10rem] truncate text-sm font-semibold text-oni-ink-strong lg:max-w-[14rem]">
          {{ tenantService.currentTenant()?.name ?? '—' }}
        </span>
        <span class="text-[10px] font-medium uppercase tracking-[0.14em] text-oni-ink-mute">
          {{ tenantService.tenants().length }} server{{ tenantService.tenants().length === 1 ? '' : 's' }}
        </span>
      </span>
      <oni-icon name="chevron-down" [size]="14" class="shrink-0" />
    </button>

    @if (open()) {
      <div
        role="menu"
        class="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-oni-border bg-oni-surface"
        style="box-shadow: var(--shadow-oni-pop)"
      >
        <p class="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-oni-ink-mute">
          Switch server
        </p>
        <ul class="max-h-72 overflow-y-auto py-1">
          @for (t of tenantService.tenants(); track t.id) {
            <li>
              <button
                type="button"
                role="menuitem"
                (click)="select(t)"
                class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-oni-surface-mute"
                [class.bg-oni-primary-soft]="t.id === tenantService.currentTenant()?.id"
              >
                <span class="flex items-center gap-3 min-w-0">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-oni-primary-soft text-xs font-bold text-oni-primary-deep"
                  >
                    {{ initialFor(t) }}
                  </span>
                  <span class="flex min-w-0 flex-col leading-tight">
                    <span class="truncate font-medium text-oni-ink-strong">{{ t.name }}</span>
                    <span class="truncate text-[11px] text-oni-ink-mute">{{ t.slug }}</span>
                  </span>
                </span>
                @if (t.id === tenantService.currentTenant()?.id) {
                  <oni-icon name="check" [size]="14" class="text-oni-primary-deep" />
                }
              </button>
            </li>
          }
        </ul>
        <div class="border-t border-oni-border">
          <button
            type="button"
            role="menuitem"
            (click)="addServer()"
            class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-oni-primary-deep transition hover:bg-oni-surface-mute"
          >
            <oni-icon name="plus" [size]="14" />
            Add a new server
          </button>
        </div>
      </div>
    }
  `,
})
export class ServerSwitcherComponent implements OnInit {
  tenantService = inject(TenantService);
  private settingsService = inject(SettingsService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  open = signal(false);

  ngOnInit(): void {
    // No initial work — TenantService is hydrated by /auth/me earlier in the
    // lifecycle. We just render whatever it has.
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    if (this.open()) this.open.set(false);
  }

  initial(): string {
    return (this.tenantService.currentTenant()?.name ?? '?').charAt(0).toUpperCase();
  }

  initialFor(t: Tenant): string {
    return (t.name ?? '?').charAt(0).toUpperCase();
  }

  select(t: Tenant): void {
    this.close();
    if (t.id === this.tenantService.currentTenant()?.id) return;
    this.tenantService.setTenant(t);
    // Reload tenant-scoped state: the new tenant has its own settings
    // (kill switch, execution, etc.) — refresh before any other component
    // re-fetches stale data.
    this.settingsService.load().subscribe({
      complete: () => this.router.navigate(['/dashboard']),
    });
  }

  addServer(): void {
    this.close();
    this.router.navigate(['/onboarding']);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
