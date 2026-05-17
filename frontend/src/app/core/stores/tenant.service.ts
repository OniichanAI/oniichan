import { Injectable, computed, signal } from '@angular/core';
import { Tenant } from '../http/tenant.model';

const STORAGE_KEY = 'last_tenant_id';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private tenantsSignal = signal<Tenant[]>([]);
  private currentTenantSignal = signal<Tenant | null>(null);

  tenants = this.tenantsSignal.asReadonly();
  currentTenant = this.currentTenantSignal.asReadonly();
  hasTenant = computed(() => this.currentTenantSignal() !== null);

  /**
   * Hydrate from /auth/me. Re-selects the last-used tenant when it's still in
   * the list, otherwise clears the current selection.
   */
  setTenants(tenants: Tenant[]): void {
    this.tenantsSignal.set(tenants);

    const current = this.currentTenantSignal();
    if (current) {
      const fresh = tenants.find((t) => t.id === current.id);
      this.currentTenantSignal.set(fresh ?? null);
      if (!fresh) this.forgetLast();
      return;
    }

    const lastId = this.readLast();
    if (lastId) {
      const match = tenants.find((t) => t.id === lastId);
      if (match) {
        this.currentTenantSignal.set(match);
        return;
      }
      this.forgetLast();
    }
  }

  setTenant(tenant: Tenant): void {
    this.currentTenantSignal.set(tenant);
    this.rememberLast(tenant.id);
    if (!this.tenantsSignal().some((t) => t.id === tenant.id)) {
      this.tenantsSignal.update((current) => [...current, tenant]);
    }
  }

  getTenantId(): string | null {
    const tenant = this.currentTenantSignal();
    return tenant ? tenant.id : null;
  }

  clear(): void {
    this.tenantsSignal.set([]);
    this.currentTenantSignal.set(null);
    this.forgetLast();
  }

  private readLast(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private rememberLast(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* private mode / quota — ignore */
    }
  }

  private forgetLast(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
