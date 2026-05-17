import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card/card.component';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/stores/tenant.service';
import { AuditEvent, AuditService } from '../audit/audit.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CardComponent],
  template: `
    <div class="space-y-6">
      <app-card padding="lg">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Current server</p>
            <h2 class="mt-1 text-2xl font-bold text-slate-900">
              {{ tenantService.currentTenant()?.name ?? '—' }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Signed in as
              <span class="font-medium text-slate-700">{{ authService.user()?.username ?? '—' }}</span>
            </p>
          </div>
          <a
            routerLink="/chatops"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752C4]"
          >
            Open ChatOps
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </app-card>

      <div class="grid gap-6 md:grid-cols-3">
        <app-card padding="md">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit events</h3>
          <p class="mt-2 text-3xl font-bold text-slate-900">{{ totalEvents() }}</p>
          <p class="mt-1 text-xs text-slate-500">All actions, AI and human</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Connected servers</h3>
          <p class="mt-2 text-3xl font-bold text-slate-900">{{ tenantService.tenants().length }}</p>
          <p class="mt-1 text-xs text-slate-500">Across your account</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Autonomy</h3>
          <p class="mt-2 text-3xl font-bold text-slate-900">Off</p>
          <p class="mt-1 text-xs text-slate-500">Manual confirmation required</p>
        </app-card>
      </div>

      <app-card title="Recent activity" subtitle="Latest five audit events for this server.">
        @if (loading()) {
          <div class="flex items-center justify-center py-8 text-slate-400">
            <div class="h-5 w-5 animate-spin rounded-full border-4 border-solid border-[#5865F2] border-r-transparent"></div>
            <span class="ml-2 text-xs">Loading...</span>
          </div>
        } @else if (recent().length === 0) {
          <p class="py-6 text-center text-sm text-slate-500">No activity yet.</p>
        } @else {
          <ul class="mt-2 divide-y divide-slate-100">
            @for (event of recent(); track event.id) {
              <li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  [class.bg-red-500]="event.risk_tier === 'high'"
                  [class.bg-orange-500]="event.risk_tier === 'medium'"
                  [class.bg-slate-400]="event.risk_tier === 'low'"
                ></span>
                <div class="flex-1">
                  <p class="text-sm text-slate-700">{{ event.summary }}</p>
                  <p class="mt-0.5 text-xs text-slate-400">
                    <span class="font-mono">{{ event.event_type }}</span>
                    · {{ event.created_at | date:'short' }}
                  </p>
                </div>
              </li>
            }
          </ul>
          <a
            routerLink="/audit"
            class="mt-4 inline-block text-xs font-semibold text-[#5865F2] hover:underline"
          >
            View full audit log →
          </a>
        }
      </app-card>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  tenantService = inject(TenantService);
  private auditService = inject(AuditService);

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
