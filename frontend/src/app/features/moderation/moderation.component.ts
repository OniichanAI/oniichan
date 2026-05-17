import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ModerationService, ModerationState } from './moderation.service';
import { CardComponent } from '../../shared/ui/card/card.component';

@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [CommonModule, RouterLink, CardComponent],
  template: `
    <div class="space-y-6">
      <app-card title="Moderation overview" subtitle="Live snapshot pulled from Discord plus tenant-scoped audit counts.">
        <div class="mt-4 flex gap-3 text-xs text-slate-500">
          <button
            (click)="reload()"
            [disabled]="loading()"
            class="rounded-xl border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
          >
            {{ loading() ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </app-card>

      @if (loading() && !state()) {
        <div class="flex items-center justify-center py-12 text-slate-400">
          <div class="h-6 w-6 animate-spin rounded-full border-4 border-solid border-[#5865F2] border-r-transparent"></div>
          <span class="ml-3 text-sm">Loading server state...</span>
        </div>
      } @else {
        <div class="grid gap-6 md:grid-cols-4">
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Members</h3>
            <p class="mt-2 text-2xl font-bold text-slate-900">
              {{ formatNumber(state()?.guild?.member_count) }}
            </p>
            <p class="mt-1 text-xs text-slate-500">Approximate (via Discord)</p>
          </app-card>
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Channels</h3>
            <p class="mt-2 text-2xl font-bold text-slate-900">
              {{ formatNumber(state()?.guild?.channel_count) }}
            </p>
            <p class="mt-1 text-xs text-slate-500">All types</p>
          </app-card>
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Text channels</h3>
            <p class="mt-2 text-2xl font-bold text-[#5865F2]">
              {{ formatNumber(state()?.guild?.text_channel_count) }}
            </p>
          </app-card>
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Voice channels</h3>
            <p class="mt-2 text-2xl font-bold text-orange-600">
              {{ formatNumber(state()?.guild?.voice_channel_count) }}
            </p>
          </app-card>
        </div>

        <app-card title="Audit activity" subtitle="Total recorded actions for this tenant.">
          <div class="mt-4 flex items-center justify-between">
            <div>
              <p class="text-4xl font-bold text-slate-900">{{ state()?.recent_actions ?? 0 }}</p>
              <p class="mt-1 text-xs text-slate-500">All event types</p>
            </div>
            <a
              routerLink="/audit"
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[#5865F2] hover:text-[#5865F2]"
            >
              Open audit log →
            </a>
          </div>
        </app-card>

        @if (!state()?.guild?.member_count) {
          <app-card padding="md">
            <p class="text-sm text-slate-600">
              Member and channel counts come from Discord using your bot token. If they're empty,
              make sure <code class="rounded bg-slate-100 px-1 py-0.5 text-xs">DISCORD_BOT_TOKEN</code>
              is set in <code class="rounded bg-slate-100 px-1 py-0.5 text-xs">backend/.env</code> and the
              bot is still in the server.
            </p>
          </app-card>
        }
      }
    </div>
  `,
})
export class ModerationComponent implements OnInit {
  private moderationService = inject(ModerationService);

  state = signal<ModerationState | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.moderationService.getState().subscribe({
      next: (s) => {
        this.state.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  formatNumber(value: number | null | undefined): string {
    return value == null ? '—' : value.toLocaleString();
  }
}
