import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TenantApiService } from '../../../core/http/tenant-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TenantService } from '../../../core/stores/tenant.service';
import { SettingsService } from '../../../core/stores/settings.service';
import { Tenant } from '../../../core/http/tenant.model';
import { OniWordmarkComponent } from '../../../core/branding/oni-wordmark.component';
import { ONI } from '../../../core/branding/microcopy';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, OniWordmarkComponent],
  template: `
    <div class="flex min-h-screen items-center justify-center px-4 py-12">
      <div class="w-full max-w-3xl space-y-10">
        <div class="flex flex-col items-center gap-4 text-center">
          <oni-wordmark size="md" />
          <h2 class="text-3xl font-bold tracking-tight text-oni-ink-strong">
            {{ copy.onboarding.title }}
          </h2>
          <p class="text-sm text-oni-ink">{{ copy.onboarding.sub }}</p>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          @for (tenant of tenantService.tenants(); track tenant.id) {
            <button
              (click)="onSelectTenant(tenant)"
              class="group flex flex-col items-center justify-center rounded-3xl border border-oni-border bg-oni-surface p-6 transition-all hover:-translate-y-0.5 hover:border-oni-primary"
              style="box-shadow: var(--shadow-oni-soft)"
            >
              <div
                class="flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl font-bold text-white"
                style="background: linear-gradient(135deg, #ff7ab6 0%, #d14a89 100%)"
              >
                {{ tenant.name.charAt(0).toUpperCase() }}
              </div>
              <h3 class="mt-4 font-semibold text-oni-ink-strong">{{ tenant.name }}</h3>
              <p class="mt-1 text-xs text-oni-ink-mute">{{ tenant.slug }}</p>
            </button>
          }

          <button
            (click)="onAddServer()"
            [disabled]="installing()"
            class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-oni-border-strong bg-transparent p-6 transition-all hover:border-oni-primary hover:bg-oni-surface-mute disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-oni-primary-soft text-oni-primary-deep">
              <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 class="mt-4 font-semibold text-oni-ink-strong">
              {{ installing() ? copy.onboarding.installing : copy.onboarding.addServer }}
            </h3>
            <p class="mt-1 text-xs text-oni-ink-mute">{{ copy.onboarding.addServerSub }}</p>
          </button>
        </div>

        @if (tenantService.tenants().length === 0) {
          <p class="text-center text-sm text-oni-ink-mute">{{ copy.onboarding.emptyHint }}</p>
        }
      </div>
    </div>
  `,
})
export class OnboardingComponent implements OnInit {
  private tenantApi = inject(TenantApiService);
  private authService = inject(AuthService);
  private settingsService = inject(SettingsService);
  tenantService = inject(TenantService);
  private router = inject(Router);

  installing = signal(false);
  readonly copy = ONI;

  ngOnInit(): void {
    this.authService.checkAuth().subscribe();
  }

  onSelectTenant(tenant: Tenant): void {
    this.tenantService.setTenant(tenant);
    this.settingsService.load().subscribe({ complete: () => this.router.navigate(['/dashboard']) });
  }

  onAddServer(): void {
    this.installing.set(true);
    this.tenantApi.getBotInstallUrl().subscribe({
      next: (response) => {
        window.location.href = response.install_url;
      },
      error: () => this.installing.set(false),
    });
  }
}
