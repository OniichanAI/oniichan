import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TenantService } from '../../stores/tenant.service';
import { SettingsService } from '../../stores/settings.service';
import { AuthService } from '../../auth/auth.service';
import { OniIconComponent } from '../../branding/oni-icon.component';
import { ThemeToggleComponent } from '../../branding/theme-toggle.component';
import { ServerSwitcherComponent } from '../server-switcher/server-switcher.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { LayoutService } from '../layout.service';
import { ONI } from '../../branding/microcopy';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    OniIconComponent,
    ThemeToggleComponent,
    ServerSwitcherComponent,
    SidebarComponent,
  ],
  template: `
    <div class="flex h-screen">
      <oni-sidebar />

      <!-- Main column. On mobile the sidebar overlays this, not displaces it. -->
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-oni-border bg-oni-surface px-3 sm:px-6">
          <div class="flex min-w-0 items-center gap-2">
            <!-- Hamburger: only visible below lg. -->
            <button
              type="button"
              (click)="layout.toggleMobile()"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-oni-ink-strong transition hover:bg-oni-surface-mute lg:hidden"
              [attr.aria-label]="layout.mobileOpen() ? 'Close menu' : 'Open menu'"
            >
              <oni-icon name="menu" [size]="18" />
            </button>

            <!-- Collapse toggle: only visible on lg+. -->
            <button
              type="button"
              (click)="layout.toggleCollapsed()"
              class="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-oni-ink-mute transition hover:bg-oni-surface-mute hover:text-oni-ink-strong lg:flex"
              [attr.aria-label]="layout.collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
              [title]="layout.collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
            >
              <oni-icon [name]="layout.collapsed() ? 'panel-left-open' : 'panel-left-close'" [size]="18" />
            </button>

            <oni-server-switcher />
          </div>

          <div class="flex shrink-0 items-center gap-2 sm:gap-3">
            <oni-theme-toggle />
            @if (settingsService.killSwitch()) {
              <a
                routerLink="/settings"
                class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-oni-danger-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-oni-danger ring-1 ring-inset ring-oni-danger/30 transition hover:brightness-110"
              >
                <oni-icon name="alert-triangle" [size]="12" [strokeWidth]="2.5" />
                <span class="hidden sm:inline">{{ copy.shell.badgeKill }}</span>
              </a>
            } @else if (settingsService.execution()) {
              <span class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-oni-success-soft px-3 py-1 text-xs font-semibold text-oni-success ring-1 ring-inset ring-oni-success/30">
                <span class="h-1.5 w-1.5 rounded-full bg-oni-success"></span>
                <span class="hidden sm:inline">{{ copy.shell.badgeLive }}</span>
              </span>
            } @else {
              <span class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-oni-surface-mute px-3 py-1 text-xs font-semibold text-oni-ink-mute ring-1 ring-inset ring-oni-border-strong/60">
                <span class="h-1.5 w-1.5 rounded-full bg-oni-ink-mute"></span>
                <span class="hidden sm:inline">{{ copy.shell.badgeDryRun }}</span>
              </span>
            }
          </div>
        </header>

        <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent implements OnInit {
  tenantService = inject(TenantService);
  settingsService = inject(SettingsService);
  authService = inject(AuthService);
  layout = inject(LayoutService);
  readonly copy = ONI;

  ngOnInit(): void {
    this.authService.checkAuth().subscribe();
    this.settingsService.load().subscribe();
  }
}
