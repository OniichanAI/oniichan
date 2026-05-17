import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { RiskTier, SettingsService, TenantSettings } from '../../../core/stores/settings.service';
import { ToastService } from '../../../core/feedback/toast.service';

const RISK_OPTIONS: RiskTier[] = ['low', 'medium', 'high'];

@Component({
  selector: 'app-autonomy-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, ButtonComponent],
  template: `
    <div class="space-y-6">
      <app-card title="Autonomy & execution" subtitle="Controls what ChatOps is allowed to actually do against Discord.">
        <div
          class="mt-4 flex items-center justify-between rounded-2xl border p-4"
          [class.border-red-300]="settings()?.kill_switch_active"
          [class.bg-red-50]="settings()?.kill_switch_active"
          [class.border-slate-200]="!settings()?.kill_switch_active"
          [class.bg-slate-50]="!settings()?.kill_switch_active"
        >
          <div>
            <h4
              class="text-sm font-bold"
              [class.text-red-900]="settings()?.kill_switch_active"
              [class.text-slate-900]="!settings()?.kill_switch_active"
            >
              Global kill switch
            </h4>
            <p
              class="text-xs"
              [class.text-red-700]="settings()?.kill_switch_active"
              [class.text-slate-600]="!settings()?.kill_switch_active"
            >
              When active, every confirm falls back to dry-run regardless of other settings.
            </p>
          </div>
          <app-button
            [variant]="settings()?.kill_switch_active ? 'secondary' : 'danger'"
            size="sm"
            [loading]="saving()"
            (click)="toggleKillSwitch()"
          >
            {{ settings()?.kill_switch_active ? 'DEACTIVATE' : 'ACTIVATE' }}
          </app-button>
        </div>
      </app-card>

      @if (loading()) {
        <div class="flex items-center gap-2 text-xs text-slate-400">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-solid border-[#5865F2] border-r-transparent"></div>
          Loading settings...
        </div>
      } @else if (settings(); as s) {
        <div class="grid gap-6 md:grid-cols-2">
          <app-card title="Execution" subtitle="Master switch for live Discord side effects.">
            <div class="mt-4 space-y-4">
              <label class="flex items-start gap-3">
                <input
                  type="checkbox"
                  class="mt-1 h-4 w-4 rounded border-slate-300 text-[#5865F2] focus:ring-[#5865F2]"
                  [checked]="s.execution_enabled"
                  (change)="onToggle('execution_enabled', $event)"
                  [disabled]="saving() || s.kill_switch_active"
                />
                <div>
                  <p class="text-sm font-medium text-slate-900">Allow execution</p>
                  <p class="text-xs text-slate-500">
                    When off, confirmed actions are recorded in the audit log but skip Discord.
                  </p>
                </div>
              </label>

              <label class="flex items-start gap-3 opacity-70">
                <input
                  type="checkbox"
                  class="mt-1 h-4 w-4 rounded border-slate-300 text-[#5865F2] focus:ring-[#5865F2]"
                  [checked]="s.autonomy_enabled"
                  (change)="onToggle('autonomy_enabled', $event)"
                  [disabled]="saving() || s.kill_switch_active || !s.execution_enabled"
                />
                <div>
                  <p class="text-sm font-medium text-slate-900">Autonomous mode</p>
                  <p class="text-xs text-slate-500">
                    Reserved — when enabled, AI runs allowed-risk actions without human confirmation.
                  </p>
                </div>
              </label>
            </div>
          </app-card>

          <app-card title="Risk cap" subtitle="Highest risk tier we'll execute live.">
            <div class="mt-4 space-y-2">
              @for (tier of riskOptions; track tier) {
                <label
                  class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition"
                  [class.border-\\[\\#5865F2\\]]="s.max_risk_tier === tier"
                  [class.bg-\\[\\#5865F2\\]\\/5]="s.max_risk_tier === tier"
                  [class.border-slate-200]="s.max_risk_tier !== tier"
                >
                  <input
                    type="radio"
                    name="risk"
                    [value]="tier"
                    [checked]="s.max_risk_tier === tier"
                    (change)="setRiskTier(tier)"
                    [disabled]="saving()"
                    class="h-4 w-4 text-[#5865F2] focus:ring-[#5865F2]"
                  />
                  <div class="flex-1">
                    <p class="text-sm font-medium capitalize text-slate-900">{{ tier }}</p>
                    <p class="text-xs text-slate-500">{{ riskBlurb(tier) }}</p>
                  </div>
                </label>
              }
            </div>
          </app-card>
        </div>

        <app-card padding="md">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="text-xs text-slate-500">
              Last updated {{ s.updated_at | date:'medium' }}
            </div>
            <div class="text-[11px] text-slate-400">
              Effective state:
              <span
                class="ml-1 rounded-full px-2 py-0.5 font-semibold"
                [class.bg-red-50]="s.kill_switch_active"
                [class.text-red-700]="s.kill_switch_active"
                [class.bg-green-50]="!s.kill_switch_active && s.execution_enabled"
                [class.text-green-700]="!s.kill_switch_active && s.execution_enabled"
                [class.bg-slate-100]="!s.kill_switch_active && !s.execution_enabled"
                [class.text-slate-600]="!s.kill_switch_active && !s.execution_enabled"
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

  riskBlurb(tier: RiskTier): string {
    switch (tier) {
      case 'low':
        return 'Read-only and reversible actions (default).';
      case 'medium':
        return 'Slow mode, announcements, role tweaks.';
      case 'high':
        return 'Bans, kicks, channel deletes. Use with care.';
    }
  }

  effectiveLabel(s: TenantSettings): string {
    if (s.kill_switch_active) return 'Kill switch active';
    if (!s.execution_enabled) return 'Dry-run only';
    return `Live up to ${s.max_risk_tier}`;
  }

  private patch(update: Parameters<SettingsService['update']>[0]): void {
    this.saving.set(true);
    this.settingsService.update(update).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Settings updated');
      },
      error: () => this.saving.set(false),
    });
  }
}
