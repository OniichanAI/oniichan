import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Me, User } from './user.model';
import { Tenant } from '../http/tenant.model';
import { TenantService } from '../stores/tenant.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private tenantService = inject(TenantService);

  private userSignal = signal<User | null>(null);

  user = this.userSignal.asReadonly();
  isAuthenticated = computed(() => !!this.userSignal());

  login(): void {
    this.http
      .get<{ authorization_url: string; state: string }>('/api/v1/auth/discord/login')
      .subscribe({
        next: (response) => {
          window.location.href = response.authorization_url;
        },
      });
  }

  handleCallback(code: string, state: string): Observable<User> {
    return this.http
      .get<User>('/api/v1/auth/discord/callback', { params: { code, state } })
      .pipe(tap((user) => this.userSignal.set(user)));
  }

  completeBotInstall(guildId: string): Observable<Tenant> {
    return this.http
      .post<Tenant>('/api/v1/auth/discord/bot-installed', { guild_id: guildId })
      .pipe(
        tap((tenant) => {
          this.tenantService.setTenant(tenant);
        }),
      );
  }

  /**
   * Hydrate user + tenants from /auth/me. Single source of truth.
   * Returns the User on success, null on 401.
   */
  checkAuth(): Observable<User | null> {
    return this.http.get<Me>('/api/v1/auth/me').pipe(
      tap((me) => {
        this.userSignal.set(me.user);
        this.tenantService.setTenants(me.tenants);
      }),
      map((me) => me.user),
      catchError(() => {
        this.userSignal.set(null);
        this.tenantService.clear();
        return of(null);
      }),
    );
  }

  logout(): void {
    this.userSignal.set(null);
    this.tenantService.clear();
    // settings are cleared by the app shell before invoking this, but be defensive.
    window.location.href = '/login';
  }
}
