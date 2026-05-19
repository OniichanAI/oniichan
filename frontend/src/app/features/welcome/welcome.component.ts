import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RiskTier, SettingsService } from '../../core/stores/settings.service';
import { TenantService } from '../../core/stores/tenant.service';
import { ToastService } from '../../core/feedback/toast.service';
import { OniMascotComponent } from '../../core/branding/oni-mascot.component';
import { OniWordmarkComponent } from '../../core/branding/oni-wordmark.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';

type StepKey = 'greeting' | 'risk' | 'execution' | 'safety';

interface StepDef {
  key: StepKey;
  number: number;
  title: string;
  body: string;
  mood: 'happy' | 'serious' | 'dry' | 'angry';
}

const STEPS: StepDef[] = [
  {
    key: 'greeting',
    number: 1,
    title: 'Yokoso, onii-chan',
    body:
      "I'm Oniichan. I keep an eye on your Discord server so you don't have to babysit every shitpost. " +
      "Before we begin, a quick tour through the safety dials — takes 30 seconds.",
    mood: 'happy',
  },
  {
    key: 'risk',
    number: 2,
    title: 'Pick how far onii-chan is allowed to swing',
    body:
      "Risk cap controls the worst thing onii-chan is allowed to do without a different human approving. " +
      "Default is Low — totally safe. You can raise it later from Settings.",
    mood: 'serious',
  },
  {
    key: 'execution',
    number: 3,
    title: 'Live moves vs. dry-run',
    body:
      "By default, every confirmed action is recorded but not actually sent to Discord. " +
      "Flip live execution on only when you're ready to let onii-chan touch your server. " +
      "You can always toggle it back later — or hit the kill switch.",
    mood: 'dry',
  },
  {
    key: 'safety',
    number: 4,
    title: 'The kill switch is right there',
    body:
      "If anything looks weird, hit the kill switch in Settings or the top bar. " +
      "Every confirm immediately falls back to dry-run, no questions asked. " +
      "Onii-chan stands down until you say so.",
    mood: 'angry',
  },
];

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [
    CommonModule,
    OniMascotComponent,
    OniWordmarkComponent,
    ButtonComponent,
  ],
  template: `
    <div class="flex min-h-screen items-center justify-center px-4 py-12">
      <div
        class="w-full max-w-2xl rounded-3xl border border-oni-border bg-oni-surface p-10"
        style="box-shadow: var(--shadow-oni-pop)"
      >
        <div class="flex items-center justify-between">
          <oni-wordmark size="md" />
          <div class="flex items-center gap-1.5">
            @for (s of steps; track s.key) {
              <span
                class="h-1.5 w-6 rounded-full transition-colors"
                [class.bg-oni-primary]="s.number <= step().number"
                [class.bg-oni-border-strong]="s.number > step().number"
              ></span>
            }
          </div>
        </div>

        <div class="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-start">
          <oni-mascot size="lg" [mood]="step().mood" />
          <div class="flex-1">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-oni-ink-mute">
              Step {{ step().number }} of {{ steps.length }}
            </p>
            <h2 class="mt-1 text-2xl font-bold text-oni-ink-strong">{{ step().title }}</h2>
            <p class="mt-3 text-sm text-oni-ink">{{ step().body }}</p>

            @if (step().key === 'risk') {
              <div class="mt-5 space-y-2">
                @for (tier of riskOptions; track tier) {
                  <label
                    class="flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition"
                    [class.border-oni-primary]="riskChoice() === tier"
                    [class.bg-oni-primary-soft]="riskChoice() === tier"
                    [class.border-oni-border]="riskChoice() !== tier"
                  >
                    <input
                      type="radio"
                      name="risk"
                      [value]="tier"
                      [checked]="riskChoice() === tier"
                      (change)="riskChoice.set(tier)"
                      class="h-4 w-4 text-oni-primary focus:ring-oni-primary"
                    />
                    <div>
                      <p class="text-sm font-medium capitalize text-oni-ink-strong">{{ tier }}</p>
                      <p class="text-xs text-oni-ink-mute">{{ riskBlurb(tier) }}</p>
                    </div>
                  </label>
                }
              </div>
            }

            @if (step().key === 'execution') {
              <label class="mt-5 flex items-start gap-3 rounded-2xl border border-oni-border bg-oni-surface-mute p-4">
                <input
                  type="checkbox"
                  class="mt-1 h-4 w-4 rounded border-oni-border text-oni-primary focus:ring-oni-primary"
                  [checked]="executionChoice()"
                  (change)="onExecToggle($event)"
                />
                <div>
                  <p class="text-sm font-medium text-oni-ink-strong">
                    Turn on live execution now
                  </p>
                  <p class="text-xs text-oni-ink-mute">
                    Leave this off if you want to test onii-chan's intent parsing first. You can flip it on from Settings any time.
                  </p>
                </div>
              </label>
            }
          </div>
        </div>

        <div class="mt-8 flex items-center justify-between">
          <button
            class="text-xs font-medium text-oni-ink-mute transition hover:text-oni-primary-deep"
            (click)="onSkip()"
            [disabled]="saving()"
          >
            Skip — use defaults
          </button>
          <div class="flex gap-2">
            @if (step().number > 1) {
              <app-button variant="secondary" size="sm" (click)="prev()" [disabled]="saving()">
                Back
              </app-button>
            }
            @if (isLast()) {
              <app-button variant="primary" size="sm" (click)="finish()" [loading]="saving()">
                Let’s go
              </app-button>
            } @else {
              <app-button variant="primary" size="sm" (click)="next()" [disabled]="saving()">
                Next
              </app-button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class WelcomeComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private tenantService = inject(TenantService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly steps = STEPS;
  readonly riskOptions: RiskTier[] = ['low', 'medium', 'high'];

  private stepIndex = signal(0);
  step = computed(() => STEPS[this.stepIndex()]);
  isLast = computed(() => this.stepIndex() === STEPS.length - 1);

  riskChoice = signal<RiskTier>('low');
  executionChoice = signal(false);
  saving = signal(false);

  ngOnInit(): void {
    // Hydrate from existing settings so a partial wizard run picks up where it left off.
    this.settingsService.load().subscribe({
      next: (s) => {
        this.riskChoice.set(s.max_risk_tier);
        this.executionChoice.set(s.execution_enabled);
      },
    });
  }

  next(): void {
    if (this.stepIndex() < STEPS.length - 1) {
      this.stepIndex.update((v) => v + 1);
    }
  }

  prev(): void {
    if (this.stepIndex() > 0) {
      this.stepIndex.update((v) => v - 1);
    }
  }

  onExecToggle(event: Event): void {
    this.executionChoice.set((event.target as HTMLInputElement).checked);
  }

  finish(): void {
    this.persist({
      max_risk_tier: this.riskChoice(),
      execution_enabled: this.executionChoice(),
      bootstrap_completed: true,
    });
  }

  onSkip(): void {
    // Skipping locks in safe defaults but still marks bootstrap complete so the
    // wizard doesn't reappear. User can always tune in Settings.
    this.persist({
      max_risk_tier: 'low',
      execution_enabled: false,
      bootstrap_completed: true,
    });
  }

  riskBlurb(tier: RiskTier): string {
    switch (tier) {
      case 'low':
        return 'Read-only and reversible. Safe default.';
      case 'medium':
        return 'Slow mode, announcements, role tweaks.';
      case 'high':
        return 'Bans, kicks, channel deletes. Use carefully.';
    }
  }

  private persist(patch: Parameters<SettingsService['update']>[0]): void {
    this.saving.set(true);
    this.settingsService.update(patch).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(`Onii-chan is ready for ${this.tenantService.currentTenant()?.name ?? 'duty'}.`);
        this.router.navigate(['/dashboard']);
      },
      error: () => this.saving.set(false),
    });
  }
}
