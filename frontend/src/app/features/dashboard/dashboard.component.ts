import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card/card.component';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/stores/tenant.service';
import { SettingsService } from '../../core/stores/settings.service';
import { AuditEvent, AuditService } from '../audit/audit.service';
import { OniMascotComponent } from '../../core/branding/oni-mascot.component';
import { OniEmptyComponent } from '../../core/branding/oni-empty.component';
import { OniIconComponent } from '../../core/branding/oni-icon.component';
import { ONI } from '../../core/branding/microcopy';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    OniMascotComponent,
    OniEmptyComponent,
    OniIconComponent,
  ],
  template: `
    <div class="space-y-8">
      <app-card padding="lg">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-4">
            <oni-mascot
              size="lg"
              [mood]="settingsService.killSwitch() ? 'angry' : (settingsService.execution() ? 'serious' : 'happy')"
              [live]="settingsService.execution() && !settingsService.killSwitch()"
            />
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-oni-ink-mute">
                {{ copy.dashboard.currentServerLabel }}
              </p>
              <h2 class="mt-1 truncate text-2xl font-bold text-oni-ink-strong">
                {{ tenantService.currentTenant()?.name ?? '—' }}
              </h2>
              <p class="mt-1 text-sm text-oni-ink">
                Signed in as
                <span class="font-medium text-oni-ink-strong">{{ authService.user()?.username ?? '—' }}</span>
              </p>
            </div>
          </div>
          <a
            routerLink="/chatops"
            class="inline-flex shrink-0 items-center justify-center gap-2 self-start whitespace-nowrap rounded-2xl bg-oni-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-oni-primary-deep sm:self-auto"
            style="box-shadow: var(--shadow-oni-soft)"
          >
            {{ copy.dashboard.primaryCta }}
            <oni-icon name="arrow-right" [size]="16" />
          </a>
        </div>
      </app-card>

      <div class="grid gap-6 md:grid-cols-3">
        <app-card padding="md">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-oni-ink-mute">
            {{ copy.dashboard.statAuditLabel }}
          </h3>
          <p class="mt-2 text-3xl font-bold text-oni-ink-strong">{{ totalEvents() }}</p>
          <p class="mt-1 text-xs text-oni-ink-mute">{{ copy.dashboard.statAuditHint }}</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-oni-ink-mute">
            {{ copy.dashboard.statServersLabel }}
          </h3>
          <p class="mt-2 text-3xl font-bold text-oni-ink-strong">{{ tenantService.tenants().length }}</p>
          <p class="mt-1 text-xs text-oni-ink-mute">{{ copy.dashboard.statServersHint }}</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-oni-ink-mute">
            {{ settingsService.execution() ? copy.dashboard.statAutonomyLabelOn : copy.dashboard.statAutonomyLabelOff }}
          </h3>
          <p
            class="mt-2 text-3xl font-bold"
            [class.text-oni-success]="settingsService.execution() && !settingsService.killSwitch()"
            [class.text-oni-danger]="settingsService.killSwitch()"
            [class.text-oni-ink-strong]="!settingsService.execution() && !settingsService.killSwitch()"
          >
            {{ settingsService.killSwitch() ? 'Stop' : (settingsService.execution() ? 'Live' : 'Off') }}
          </p>
          <p class="mt-1 text-xs text-oni-ink-mute">{{ copy.dashboard.statAutonomyHint }}</p>
        </app-card>
      </div>

      <app-card
        [title]="copy.dashboard.recentActivityTitle"
        [subtitle]="copy.dashboard.recentActivitySub"
      >
        @if (loading()) {
          <div class="flex items-center justify-center py-8 text-oni-ink-mute">
            <div class="h-5 w-5 animate-spin rounded-full border-4 border-solid border-oni-primary border-r-transparent"></div>
            <span class="ml-2 text-xs">Loading...</span>
          </div>
        } @else if (recent().length === 0) {
          <oni-empty mood="dry" size="sm" [message]="copy.dashboard.recentEmpty" />
        } @else {
          <ul class="mt-2 divide-y divide-oni-border">
            @for (event of recent(); track event.id) {
              <li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  [class.bg-oni-danger]="event.risk_tier === 'high'"
                  [class.bg-oni-warn]="event.risk_tier === 'medium'"
                  [class.bg-oni-ink-mute]="event.risk_tier === 'low'"
                ></span>
                <div class="flex-1">
                  <p class="text-sm text-oni-ink">{{ event.summary }}</p>
                  <p class="mt-0.5 text-xs text-oni-ink-mute">
                    <span class="font-mono">{{ event.event_type }}</span>
                    · {{ event.created_at | date:'short' }}
                  </p>
                </div>
              </li>
            }
          </ul>
          <a
            routerLink="/audit"
            class="mt-4 inline-block text-xs font-semibold text-oni-primary-deep hover:underline"
          >
            {{ copy.dashboard.seeAll }}
          </a>
        }
      </app-card>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  tenantService = inject(TenantService);
  settingsService = inject(SettingsService);
  private auditService = inject(AuditService);
  readonly copy = ONI;

  recent = signal<AuditEvent[]>([]);
  totalEvents = signal(0);
  loading = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.auditService.list({ limit: 5, offset: 0 }).subscribe({
      next: (result) => {
        this.recent.set(result.items);
        this.totalEvents.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
