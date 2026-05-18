import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { LayoutService } from '../layout.service';
import { OniWordmarkComponent } from '../../branding/oni-wordmark.component';
import { OniMascotComponent } from '../../branding/oni-mascot.component';
import { OniIconComponent, OniIconName } from '../../branding/oni-icon.component';
import { ONI } from '../../branding/microcopy';
import { SettingsService } from '../../stores/settings.service';

interface NavItem {
  path: string;
  label: string;
  icon: OniIconName;
}

const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'home' },
  { path: '/chatops', label: 'ChatOps', icon: 'message-square' },
  { path: '/moderation', label: 'Moderation', icon: 'shield' },
  { path: '/audit', label: 'Audit Log', icon: 'file-text' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

/**
 * Sidebar with three visual states driven by LayoutService + data-attribute
 * variants in Tailwind:
 *
 *   1. Desktop expanded (≥ lg, collapsed=false) — 256px, full labels.
 *   2. Desktop collapsed (≥ lg, collapsed=true) — 64px icon rail, labels
 *      surface as title-tooltips so destinations stay discoverable.
 *   3. Mobile drawer (< lg, mobileOpen=true) — fixed overlay, full labels.
 *      Backdrop closes on tap.
 *
 * On mobile the sidebar is always logically "expanded" — the rail only
 * makes sense on screens big enough to fit the page next to it.
 */
@Component({
  selector: 'oni-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    OniWordmarkComponent,
    OniMascotComponent,
    OniIconComponent,
  ],
  styles: [':host { display: contents; }'],
  template: `
    @if (layout.mobileOpen()) {
      <div
        class="fixed inset-0 z-30 bg-oni-ink-strong/40 backdrop-blur-sm lg:hidden"
        (click)="layout.closeMobile()"
        aria-hidden="true"
      ></div>
    }

    <aside
      class="
        fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-oni-border bg-oni-surface
        transition-[width,transform] duration-200 ease-out
        -translate-x-full lg:static lg:translate-x-0
        data-[mobile-open=true]:translate-x-0
        data-[collapsed=true]:lg:w-16
      "
      [attr.data-collapsed]="layout.collapsed()"
      [attr.data-mobile-open]="layout.mobileOpen()"
      [attr.aria-hidden]="isHiddenForA11y()"
    >
      <div
        class="flex h-16 items-center px-5 data-[collapsed=true]:px-2 data-[collapsed=true]:justify-center"
        [attr.data-collapsed]="isRail()"
      >
        @if (isRail()) {
          <oni-mascot size="md" />
        } @else {
          <oni-wordmark size="md" />
        }
      </div>

      <nav class="flex-1 space-y-1 px-3 py-4">
        @for (item of nav; track item.path) {
          <a
            [routerLink]="item.path"
            [routerLinkActiveOptions]="{ exact: false }"
            routerLinkActive="bg-oni-primary-soft text-oni-primary-deep"
            class="
              group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-oni-ink
              transition hover:bg-oni-surface-mute hover:text-oni-ink-strong
              data-[rail=true]:justify-center data-[rail=true]:gap-0 data-[rail=true]:px-0
            "
            [attr.data-rail]="isRail()"
            [title]="isRail() ? item.label : null"
            [attr.aria-label]="item.label"
          >
            <oni-icon [name]="item.icon" [size]="18" />
            @if (!isRail()) {
              <span class="truncate">{{ item.label }}</span>
            }
          </a>
        }
      </nav>

      <div class="border-t border-oni-border p-3">
        <div
          class="flex items-center gap-3 data-[rail=true]:justify-center"
          [attr.data-rail]="isRail()"
        >
          <oni-mascot size="sm" mood="happy" />
          @if (!isRail()) {
            <div class="flex-1 overflow-hidden">
              <p class="truncate text-sm font-medium text-oni-ink-strong">
                {{ authService.user()?.username ?? '—' }}
              </p>
              <button
                (click)="onLogout()"
                class="inline-flex items-center gap-1 text-xs text-oni-ink-mute transition hover:text-oni-primary-deep"
              >
                <oni-icon name="log-out" [size]="12" />
                {{ copy.shell.logout }}
              </button>
            </div>
          }
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  layout = inject(LayoutService);
  authService = inject(AuthService);
  private settingsService = inject(SettingsService);
  readonly copy = ONI;
  readonly nav = NAV;

  /**
   * The "rail" (icons-only) treatment only applies when the user has
   * collapsed the sidebar on desktop AND the mobile drawer isn't open.
   * Used to switch text→icon and to hide labels.
   */
  isRail(): boolean {
    return this.layout.collapsed() && !this.layout.mobileOpen();
  }

  /**
   * On mobile, when the drawer is closed, the sidebar is visually hidden
   * via translate-x. Mark it aria-hidden so screen readers don't tab into
   * something the user can't see.
   */
  isHiddenForA11y(): boolean {
    if (this.layout.mobileOpen()) return false;
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  }

  onLogout(): void {
    this.settingsService.clear();
    this.authService.logout();
  }
}
