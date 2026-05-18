import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { TenantService } from '../../../core/stores/tenant.service';
import { OniMascotComponent } from '../../../core/branding/oni-mascot.component';
import { ONI } from '../../../core/branding/microcopy';

type CallbackStatus = 'working' | 'error';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule, OniMascotComponent],
  template: `
    <div class="flex min-h-screen items-center justify-center px-4">
      <div
        class="w-full max-w-md rounded-3xl border border-oni-border bg-oni-surface p-10 text-center"
        style="box-shadow: var(--shadow-oni-soft)"
      >
        @if (status() === 'working') {
          <div class="flex flex-col items-center gap-4">
            <oni-mascot size="lg" mood="happy" />
            <p class="text-sm text-oni-ink">{{ message() }}</p>
            <div class="h-1.5 w-32 overflow-hidden rounded-full bg-oni-primary-soft">
              <div class="h-full w-1/3 animate-pulse rounded-full bg-oni-primary"></div>
            </div>
          </div>
        } @else {
          <div class="flex flex-col items-center gap-3">
            <oni-mascot size="lg" mood="angry" />
            <h2 class="text-lg font-bold text-oni-ink-strong">Nani?!</h2>
            <p class="text-sm text-oni-ink">{{ message() }}</p>
            <button
              (click)="goLogin()"
              class="mt-4 inline-flex items-center justify-center rounded-2xl bg-oni-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-oni-primary-deep"
            >
              Back to login
            </button>
          </div>
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
  message = signal<string>(ONI.auth.callbackWorking);

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const guildId = this.route.snapshot.queryParamMap.get('guild_id');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.fail(`Discord returned an error: ${errorParam}`);
      return;
    }

    if (guildId) {
      this.finishBotInstall(guildId);
      return;
    }

    if (code && state) {
      this.authService.handleCallback(code, state).subscribe({
        next: () => this.router.navigate(['/onboarding']),
        error: (err) => this.fail(this.extractError(err, ONI.auth.callbackError)),
      });
      return;
    }

    this.fail('Missing OAuth parameters.');
  }

  goLogin(): void {
    this.router.navigate(['/login']);
  }

  private finishBotInstall(guildId: string): void {
    this.message.set(ONI.auth.callbackInstalling);
    this.authService.completeBotInstall(guildId).subscribe({
      next: (tenant) => {
        this.tenantService.setTenant(tenant);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => this.fail(this.extractError(err, ONI.auth.callbackError)),
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
