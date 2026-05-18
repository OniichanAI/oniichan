import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type RiskTier = 'low' | 'medium' | 'high';

export interface TenantSettings {
  execution_enabled: boolean;
  autonomy_enabled: boolean;
  max_risk_tier: RiskTier;
  kill_switch_active: boolean;
  bootstrap_completed: boolean;
  updated_at: string;
}

export type TenantSettingsPatch = Partial<
  Pick<
    TenantSettings,
    | 'execution_enabled'
    | 'autonomy_enabled'
    | 'max_risk_tier'
    | 'kill_switch_active'
    | 'bootstrap_completed'
  >
>;

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);

  private settingsSignal = signal<TenantSettings | null>(null);
  settings = this.settingsSignal.asReadonly();
  killSwitch = computed(() => this.settingsSignal()?.kill_switch_active ?? false);
  execution = computed(() => this.settingsSignal()?.execution_enabled ?? false);
  bootstrapCompleted = computed(() => this.settingsSignal()?.bootstrap_completed ?? false);

  load(): Observable<TenantSettings> {
    return this.http
      .get<TenantSettings>('/api/v1/tenants/me/settings')
      .pipe(tap((s) => this.settingsSignal.set(s)));
  }

  update(patch: TenantSettingsPatch): Observable<TenantSettings> {
    return this.http
      .put<TenantSettings>('/api/v1/tenants/me/settings', patch)
      .pipe(tap((s) => this.settingsSignal.set(s)));
  }

  clear(): void {
    this.settingsSignal.set(null);
  }
}
