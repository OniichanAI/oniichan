import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { RiskTier, SettingsService, TenantSettings } from '../../../core/stores/settings.service';
import { ToastService } from '../../../core/feedback/toast.service';
import { ONI } from '../../../core/branding/microcopy';

const RISK_OPTIONS: RiskTier[] = ['low', 'medium', 'high'];

@Component({
  selector: 'app-autonomy-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, ButtonComponent],
  template: `
    <div class="space-y-8">
      <app-card [title]="copy.settings.title" [subtitle]="copy.settings.sub">
        <div
          class="mt-4 flex flex-col gap-4 rounded-3xl border p-5 transition sm:flex-row sm:items-center sm:justify-between"
          [class.border-oni-danger]="settings()?.kill_switch_active"
          [class.bg-oni-danger-soft]="settings()?.kill_switch_active"
          [class.border-oni-border]="!settings()?.kill_switch_active"
          [class.bg-oni-surface-mute]="!settings()?.kill_switch_active"
        >
          <div class="min-w-0">
            <h4
              class="text-sm font-bold"
              [class.text-oni-danger]="settings()?.kill_switch_active"
              [class.text-oni-ink-strong]="!settings()?.kill_switch_active"
            >
              {{ settings()?.kill_switch_active ? copy.settings.killTitleOn : copy.settings.killTitleOff }}
            </h4>
            <p
              class="mt-1 text-xs"
              [class.text-oni-danger]="settings()?.kill_switch_active"
              [class.text-oni-ink]="!settings()?.kill_switch_active"
            >
              {{ settings()?.kill_switch_active ? copy.settings.killSubOn : copy.settings.killSubOff }}
            </p>
          </div>
          <div class="self-start sm:self-auto">
            <app-button
              [variant]="settings()?.kill_switch_active ? 'secondary' : 'danger'"
              size="sm"
              [loading]="saving()"
              (click)="toggleKillSwitch()"
            >
              {{ settings()?.kill_switch_active ? copy.settings.killBtnOn : copy.settings.killBtnOff }}
            </app-button>
          </div>
        </div>
      </app-card>

      @if (loading()) {
        <div class="flex items-center gap-2 text-xs text-oni-ink-mute">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-solid border-oni-primary border-r-transparent"></div>
          Loading settings...
        </div>
      } @else if (settings(); as s) {
        <div class="grid gap-6 md:grid-cols-2">
          <app-card [title]="copy.settings.executionTitle" [subtitle]="copy.settings.executionSub">
            <div class="mt-4 space-y-4">
              <label class="flex items-start gap-3">
                <input
                  type="checkbox"
                  class="mt-1 h-4 w-4 rounded border-oni-border text-oni-primary focus:ring-oni-primary"
                  [checked]="s.execution_enabled"
                  (change)="onToggle('execution_enabled', $event)"
                  [disabled]="saving() || s.kill_switch_active"
                />
                <div>
                  <p class="text-sm font-medium text-oni-ink-strong">{{ copy.settings.executionToggleLabel }}</p>
                  <p class="text-xs text-oni-ink-mute">{{ copy.settings.executionToggleSub }}</p>
                </div>
              </label>

              <label class="flex items-start gap-3 opacity-70">
                <input
                  type="checkbox"
                  class="mt-1 h-4 w-4 rounded border-oni-border text-oni-primary focus:ring-oni-primary"
                  [checked]="s.autonomy_enabled"
                  (change)="onToggle('autonomy_enabled', $event)"
                  [disabled]="saving() || s.kill_switch_active || !s.execution_enabled"
                />
                <div>
                  <p class="text-sm font-medium text-oni-ink-strong">{{ copy.settings.autonomyToggleLabel }}</p>
                  <p class="text-xs text-oni-ink-mute">{{ copy.settings.autonomyToggleSub }}</p>
                </div>
              </label>
            </div>
          </app-card>

          <app-card [title]="copy.settings.riskTitle" [subtitle]="copy.settings.riskSub">
            <div class="mt-4 space-y-2">
              @for (tier of riskOptions; track tier) {
                <label
                  class="flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition"
                  [class.border-oni-primary]="s.max_risk_tier === tier"
                  [class.bg-oni-primary-soft]="s.max_risk_tier === tier"
                  [class.border-oni-border]="s.max_risk_tier !== tier"
                >
                  <input
                    type="radio"
                    name="risk"
                    [value]="tier"
                    [checked]="s.max_risk_tier === tier"
                    (change)="setRiskTier(tier)"
                    [disabled]="saving()"
                    class="h-4 w-4 text-oni-primary focus:ring-oni-primary"
                  />
                  <div class="flex-1">
                    <p class="text-sm font-medium capitalize text-oni-ink-strong">{{ tier }}</p>
                    <p class="text-xs text-oni-ink-mute">{{ copy.settings.riskBlurb[tier] }}</p>
                  </div>
                </label>
              }
            </div>
          </app-card>
        </div>

        <app-card padding="md">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="text-xs text-oni-ink-mute">
              Last updated {{ s.updated_at | date:'medium' }}
            </div>
            <div class="text-[11px] text-oni-ink-mute">
              Effective state:
              <span
                class="ml-1 rounded-full px-2 py-0.5 font-semibold"
                [class.bg-oni-danger-soft]="s.kill_switch_active"
                [class.text-oni-danger]="s.kill_switch_active"
                [class.bg-oni-success-soft]="!s.kill_switch_active && s.execution_enabled"
                [class.text-oni-success]="!s.kill_switch_active && s.execution_enabled"
                [class.bg-oni-surface-mute]="!s.kill_switch_active && !s.execution_enabled"
                [class.text-oni-ink-mute]="!s.kill_switch_active && !s.execution_enabled"
              >
                {{ effectiveLabel(s) }}
              </span>
            </div>
          </div>
        </app-card>
      }
    </div>
  `,
})
export class AutonomySettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private toast = inject(ToastService);

  settings = this.settingsService.settings;
  loading = signal(false);
  saving = signal(false);
  readonly copy = ONI;
  readonly riskOptions = RISK_OPTIONS;

  ngOnInit(): void {
    this.loading.set(true);
    this.settingsService.load().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  onToggle(key: 'execution_enabled' | 'autonomy_enabled', event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.patch({ [key]: value });
  }

  toggleKillSwitch(): void {
    const current = this.settings();
    if (!current) return;
    this.patch({ kill_switch_active: !current.kill_switch_active });
  }

  setRiskTier(tier: RiskTier): void {
    this.patch({ max_risk_tier: tier });
  }

  effectiveLabel(s: TenantSettings): string {
    if (s.kill_switch_active) return this.copy.settings.effective.kill;
    if (!s.execution_enabled) return this.copy.settings.effective.dryRun;
    return this.copy.settings.effective.live(s.max_risk_tier);
  }

  private patch(update: Parameters<SettingsService['update']>[0]): void {
    this.saving.set(true);
    this.settingsService.update(update).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.copy.settings.saved);
      },
      error: () => this.saving.set(false),
    });
  }
}
