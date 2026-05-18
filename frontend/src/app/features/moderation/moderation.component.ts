import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ModerationService, ModerationState } from './moderation.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { OniIconComponent } from '../../core/branding/oni-icon.component';
import { ONI } from '../../core/branding/microcopy';

@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [CommonModule, RouterLink, CardComponent, OniIconComponent],
  template: `
    <div class="space-y-8">
      <app-card [title]="copy.moderation.title" [subtitle]="copy.moderation.sub">
        <div class="mt-4 flex gap-3">
          <button
            (click)="reload()"
            [disabled]="loading()"
            class="inline-flex items-center gap-2 rounded-2xl border border-oni-border bg-oni-surface px-4 py-1.5 text-xs font-medium text-oni-ink-strong transition hover:border-oni-primary disabled:opacity-50"
          >
            <oni-icon name="refresh-cw" [size]="12" />
            {{ loading() ? copy.moderation.refreshing : copy.moderation.refresh }}
          </button>
        </div>
      </app-card>

      @if (loading() && !state()) {
        <div class="flex items-center justify-center py-12 text-oni-ink-mute">
          <div class="h-6 w-6 animate-spin rounded-full border-4 border-solid border-oni-primary border-r-transparent"></div>
          <span class="ml-3 text-sm">Loading server state...</span>
        </div>
      } @else {
        <div class="grid gap-x-4 gap-y-6 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-5">
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-oni-ink-mute">
              {{ copy.moderation.members }}
            </h3>
            <p class="mt-2 text-2xl font-bold text-oni-ink-strong">
              {{ formatNumber(state()?.guild?.member_count) }}
            </p>
            <p class="mt-1 text-xs text-oni-ink-mute">Approximate (via Discord)</p>
          </app-card>
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-oni-ink-mute">
              {{ copy.moderation.channels }}
            </h3>
            <p class="mt-2 text-2xl font-bold text-oni-ink-strong">
              {{ formatNumber(state()?.guild?.channel_count) }}
            </p>
            <p class="mt-1 text-xs text-oni-ink-mute">{{ copy.moderation.channelsHint }}</p>
          </app-card>
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-oni-ink-mute">
              {{ copy.moderation.text }}
            </h3>
            <p class="mt-2 text-2xl font-bold text-oni-primary-deep">
              {{ formatNumber(state()?.guild?.text_channel_count) }}
            </p>
            <p class="mt-1 text-xs text-oni-ink-mute">{{ copy.moderation.textHint }}</p>
          </app-card>
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-oni-ink-mute">
              {{ copy.moderation.voice }}
            </h3>
            <p class="mt-2 text-2xl font-bold text-oni-warn">
              {{ formatNumber(state()?.guild?.voice_channel_count) }}
            </p>
            <p class="mt-1 text-xs text-oni-ink-mute">{{ copy.moderation.voiceHint }}</p>
          </app-card>
          <app-card padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-oni-ink-mute">
              {{ copy.moderation.categories }}
            </h3>
            <p class="mt-2 text-2xl font-bold text-oni-ink-mute">
              {{ formatNumber(state()?.guild?.category_count) }}
            </p>
            <p class="mt-1 text-xs text-oni-ink-mute">{{ copy.moderation.categoriesHint }}</p>
          </app-card>
        </div>

        <app-card
          [title]="copy.moderation.auditCardTitle"
          [subtitle]="copy.moderation.auditCardSub"
        >
          <div class="mt-4 flex items-center justify-between">
            <div>
              <p class="text-4xl font-bold text-oni-ink-strong">{{ state()?.recent_actions ?? 0 }}</p>
              <p class="mt-1 text-xs text-oni-ink-mute">All event types</p>
            </div>
            <a
              routerLink="/audit"
              class="rounded-2xl border border-oni-border bg-oni-surface px-4 py-2 text-sm font-medium text-oni-ink-strong transition hover:border-oni-primary hover:text-oni-primary-deep"
            >
              {{ copy.moderation.auditCardCta }}
            </a>
          </div>
        </app-card>

        @if (!state()?.guild?.member_count) {
          <app-card padding="md">
            <p class="text-sm text-oni-ink">{{ copy.moderation.noBotTokenHint }}</p>
          </app-card>
        }
      }
    </div>
  `,
})
export class ModerationComponent implements OnInit {
  private moderationService = inject(ModerationService);
  readonly copy = ONI;

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
