import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { TenantService } from '../../../core/stores/tenant.service';

type CallbackStatus = 'working' | 'error';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        @if (status() === 'working') {
          <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#5865F2] border-r-transparent"></div>
          <p class="mt-4 text-sm text-slate-600">{{ message() }}</p>
        } @else {
          <h2 class="text-lg font-semibold text-slate-900">Something went wrong</h2>
          <p class="mt-2 text-sm text-slate-600">{{ message() }}</p>
          <button
            (click)="goLogin()"
            class="mt-6 inline-flex items-center justify-center rounded-xl bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4752C4]"
          >
            Back to login
          </button>
        }
      </div>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);

  status = signal<CallbackStatus>('working');
  message = signal('Finishing up with Discord...');

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const guildId = this.route.snapshot.queryParamMap.get('guild_id');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.fail(`Discord returned an error: ${errorParam}`);
      return;
    }

    // Bot install redirect: guild_id is present (with or without a code).
    // The code from a bot-install grant only carries bot scopes, so we don't
    // exchange it — we rely on the existing session_token cookie instead.
    if (guildId) {
      this.finishBotInstall(guildId);
      return;
    }

    if (code && state) {
      this.authService.handleCallback(code, state).subscribe({
        next: () => this.router.navigate(['/onboarding']),
        error: (err) => this.fail(this.extractError(err, 'Login failed.')),
      });
      return;
    }

    this.fail('Missing OAuth parameters.');
  }

  goLogin(): void {
    this.router.navigate(['/login']);
  }

  private finishBotInstall(guildId: string): void {
    this.message.set('Installing bot and setting up your server...');
    this.authService.completeBotInstall(guildId).subscribe({
      next: (tenant) => {
        this.tenantService.setTenant(tenant);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => this.fail(this.extractError(err, 'Could not finalize bot install.')),
    });
  }

  private fail(message: string): void {
    this.status.set('error');
    this.message.set(message);
  }

  private extractError(err: unknown, fallback: string): string {
    const detail = (err as { error?: { detail?: string } })?.error?.detail;
    return detail ?? fallback;
  }
}
