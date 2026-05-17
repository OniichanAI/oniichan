import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TenantApiService } from '../../../core/http/tenant-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TenantService } from '../../../core/stores/tenant.service';
import { SettingsService } from '../../../core/stores/settings.service';
import { Tenant } from '../../../core/http/tenant.model';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div class="w-full max-w-2xl space-y-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold tracking-tight text-slate-900">Select a Server</h2>
          <p class="mt-2 text-sm text-slate-600">Choose a Discord server to manage with AI</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          @for (tenant of tenantService.tenants(); track tenant.id) {
            <button
              (click)="onSelectTenant(tenant)"
              class="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#5865F2] hover:shadow-md"
            >
              <div class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-400">
                {{ tenant.name.charAt(0) }}
              </div>
              <h3 class="mt-4 font-semibold text-slate-900">{{ tenant.name }}</h3>
              <p class="mt-1 text-xs text-slate-500">{{ tenant.slug }}</p>
            </button>
          }

          <button
            (click)="onAddServer()"
            [disabled]="installing()"
            class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-transparent p-6 transition-all hover:border-[#5865F2] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-400">
              <svg class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 class="mt-4 font-semibold text-slate-900">
              {{ installing() ? 'Opening Discord...' : 'Add New Server' }}
            </h3>
            <p class="mt-1 text-xs text-slate-500">Install the AI bot</p>
          </button>
        </div>

        @if (tenantService.tenants().length === 0) {
          <p class="text-center text-sm text-slate-500">
            You don't have any servers yet. Click "Add New Server" to install the bot.
          </p>
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

  ngOnInit(): void {
    // Refresh in case a tenant was added in another tab; ignore failures (toast
    // will show via the global error interceptor).
    this.authService.checkAuth().subscribe();
  }

  onSelectTenant(tenant: Tenant): void {
    this.tenantService.setTenant(tenant);
    // Tenant interceptor will now send the new X-Tenant-ID; pull fresh settings.
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
