import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../stores/tenant.service';

export const tenantGuard: CanActivateFn = (route, state) => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (tenantService.getTenantId()) {
    return true;
  }

  // Redirect to tenant selection page
  router.navigate(['/onboarding']);
  return false;
};
