import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { TenantService } from '../stores/tenant.service';

/**
 * Activates the tenant-scoped shell. On a fresh page load both authGuard and
 * tenantGuard fire concurrently — without awaiting the /auth/me hydration,
 * tenantGuard would see an empty store and bounce to /onboarding, even when
 * the user already has a remembered tenant. We share the in-flight auth call
 * (deduped inside AuthService) and decide after it resolves.
 */
export const tenantGuard: CanActivateFn = () => {
  const tenantService = inject(TenantService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (tenantService.hasTenant()) {
    return true;
  }

  return authService.checkAuth().pipe(
    map(() => {
      if (tenantService.hasTenant()) {
        return true;
      }
      return router.createUrlTree(['/onboarding']);
    }),
  );
};
