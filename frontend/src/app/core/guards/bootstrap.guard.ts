import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { SettingsService } from '../stores/settings.service';

/**
 * Routes a tenant's owner through /welcome on their first session after
 * install. Once they finish (or skip) the wizard, bootstrap_completed flips
 * true server-side and they're never auto-routed here again.
 *
 * Angular evaluates canActivate guards in parallel, so we can't assume
 * authGuard has hydrated the tenant signal yet. We share the deduped
 * checkAuth() observable from AuthService — if it's already in-flight, this
 * just hooks onto it without a second roundtrip; once it resolves the tenant
 * interceptor has an X-Tenant-ID to attach, and the settings request
 * succeeds. This is the same pattern tenantGuard uses.
 */
export const bootstrapGuard: CanActivateFn = (route) => {
  // Belt + suspenders: the wizard route itself never bootstrap-guards.
  if (route.routeConfig?.path === 'welcome') return true;

  const authService = inject(AuthService);
  const settingsService = inject(SettingsService);
  const router = inject(Router);

  const resolve = (): Observable<boolean | ReturnType<Router['createUrlTree']>> => {
    const cached = settingsService.settings();
    if (cached) {
      return of(cached.bootstrap_completed ? true : router.createUrlTree(['/welcome']));
    }
    return settingsService.load().pipe(
      map((s) => (s.bootstrap_completed ? true : router.createUrlTree(['/welcome']))),
    );
  };

  return authService.checkAuth().pipe(switchMap(() => resolve()));
};
