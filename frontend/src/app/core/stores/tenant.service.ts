import { Injectable, inject, signal } from '@angular/core';
import { Tenant } from '../http/tenant.model';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private http = inject(HttpClient);
  private currentTenantSignal = signal<Tenant | null>(null);
  
  currentTenant = this.currentTenantSignal.asReadonly();

  setTenant(tenant: Tenant): void {
    this.currentTenantSignal.set(tenant);
    localStorage.setItem('tenant_id', tenant.id);
  }

  getTenantId(): string | null {
    const tenant = this.currentTenantSignal();
    return tenant ? tenant.id : localStorage.getItem('tenant_id');
  }

  loadCurrentTenant() {
    const tenantId = this.getTenantId();
    if (!tenantId) return;

    this.http.get<Tenant>('/api/v1/tenants/me').subscribe({
      next: (tenant) => this.currentTenantSignal.set(tenant),
      error: () => this.clearTenant()
    });
  }

  clearTenant(): void {
    this.currentTenantSignal.set(null);
    localStorage.removeItem('tenant_id');
  }
}
