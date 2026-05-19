import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
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

  // De-duplicate concurrent /auth/me calls (e.g. authGuard + tenantGuard on
  // the same navigation). Cleared when the request finishes so a later
  // explicit refresh() actually hits the server.
  private bootstrap$: Observable<User | null> | null = null;

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
   * Hydrate user + tenants from /auth/me. Concurrent callers share one
   * in-flight request; sequential callers each get a fresh roundtrip.
   * Returns the User on success, null on 401.
   */
  checkAuth(): Observable<User | null> {
    if (this.bootstrap$) return this.bootstrap$;

    this.bootstrap$ = this.http.get<Me>('/api/v1/auth/me').pipe(
      tap((me) => {
        this.userSignal.set(me.user);
        this.tenantService.setTenants(me.tenants);
      }),
      map((me): User | null => me.user),
      catchError(() => {
        this.userSignal.set(null);
        this.tenantService.clear();
        return of<User | null>(null);
      }),
      finalize(() => {
        this.bootstrap$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.bootstrap$;
  }

  logout(): void {
    this.userSignal.set(null);
    this.tenantService.clear();
    window.location.href = '/login';
  }
}
