import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from './user.model';
import { Tenant } from '../http/tenant.model';
import { Observable, tap, of, catchError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  
  private userSignal = signal<User | null>(null);
  
  user = this.userSignal.asReadonly();
  isAuthenticated = computed(() => !!this.userSignal());

  login(): void {
    this.http.get<{ authorization_url: string; state: string }>('/api/v1/auth/discord/login').subscribe({
      next: (response) => {
        window.location.href = response.authorization_url;
      },
      error: (err) => console.error('Login error:', err),
    });
  }

  handleCallback(code: string, state: string): Observable<User> {
    return this.http
      .get<User>('/api/v1/auth/discord/callback', { params: { code, state } })
      .pipe(tap((user) => this.userSignal.set(user)));
  }

  completeBotInstall(guildId: string): Observable<Tenant> {
    return this.http.post<Tenant>('/api/v1/auth/discord/bot-installed', { guild_id: guildId });
  }

  checkAuth(): Observable<User | null> {
    if (this.userSignal()) {
      return of(this.userSignal());
    }

    return this.http.get<User>('/api/v1/auth/me').pipe(
      tap((user) => this.userSignal.set(user)),
      catchError(() => {
        this.userSignal.set(null);
        return of(null);
      })
    );
  }

  logout(): void {
    this.userSignal.set(null);
    window.location.href = '/login';
  }
}
