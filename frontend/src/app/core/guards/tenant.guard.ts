import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../stores/tenant.service';

export const tenantGuard: CanActivateFn = () => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (tenantService.hasTenant()) {
    return true;
  }

  router.navigate(['/onboarding']);
  return false;
};
