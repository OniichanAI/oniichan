import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TenantApiService } from '../../../core/http/tenant-api.service';
import { TenantService } from '../../../core/stores/tenant.service';
import { Tenant } from '../../../core/http/tenant.model';

type LoadState = 'loading' | 'ready' | 'error';

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

        @if (state() === 'loading') {
          <div class="flex flex-col items-center gap-3 py-12 text-slate-500">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#5865F2] border-r-transparent"></div>
            <span class="text-sm">Loading your servers...</span>
          </div>
        } @else if (state() === 'error') {
          <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {{ errorMessage() }}
            <button (click)="reload()" class="ml-2 font-semibold underline">Retry</button>
          </div>
        } @else {
          <div class="grid gap-4 sm:grid-cols-2">
            @for (tenant of tenants(); track tenant.id) {
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

          @if (tenants().length === 0) {
            <p class="text-center text-sm text-slate-500">
              You don't have any servers yet. Click "Add New Server" to install the bot.
            </p>
          }
        }
      </div>
    </div>
  `,
})
export class OnboardingComponent implements OnInit {
  private tenantApi = inject(TenantApiService);
  private tenantService = inject(TenantService);
  private router = inject(Router);

  tenants = signal<Tenant[]>([]);
  state = signal<LoadState>('loading');
  installing = signal(false);
  errorMessage = signal('');

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.state.set('loading');
    this.tenantApi.getTenants().subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.state.set('ready');
      },
      error: (err) => {
        this.errorMessage.set(this.extractError(err, 'Failed to load servers.'));
        this.state.set('error');
      },
    });
  }

  onSelectTenant(tenant: Tenant): void {
    this.tenantService.setTenant(tenant);
    this.router.navigate(['/dashboard']);
  }

  onAddServer(): void {
    this.installing.set(true);
    this.tenantApi.getBotInstallUrl().subscribe({
      next: (response) => {
        window.location.href = response.install_url;
      },
      error: (err) => {
        this.installing.set(false);
        this.errorMessage.set(this.extractError(err, 'Could not start bot install.'));
        this.state.set('error');
      },
    });
  }

  private extractError(err: unknown, fallback: string): string {
    const detail = (err as { error?: { detail?: string } })?.error?.detail;
    return detail ?? fallback;
  }
}
