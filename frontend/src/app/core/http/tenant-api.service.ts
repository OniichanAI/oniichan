import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tenant } from './tenant.model';

@Injectable({
  providedIn: 'root',
})
export class TenantApiService {
  private http = inject(HttpClient);

  getTenants(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>('/api/v1/tenants');
  }

  createTenant(name: string, slug: string): Observable<Tenant> {
    return this.http.post<Tenant>('/api/v1/tenants', { name, slug });
  }

  getBotInstallUrl(guildId?: string): Observable<{ install_url: string }> {
    const params: { [key: string]: string } = {};
    if (guildId) {
      params['guild_id'] = guildId;
    }
    return this.http.get<{ install_url: string }>('/api/v1/auth/discord/bot-install-url', { params });
  }
}
