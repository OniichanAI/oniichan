import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '../stores/tenant.service';

const TENANT_AGNOSTIC_PREFIXES = ['/api/v1/auth/'];

function isTenantAgnostic(url: string): boolean {
  return TENANT_AGNOSTIC_PREFIXES.some((prefix) => url.includes(prefix));
}

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (isTenantAgnostic(req.url)) {
    return next(req);
  }

  const tenantService = inject(TenantService);
  const tenantId = tenantService.getTenantId();

  if (!tenantId) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'X-Tenant-ID': tenantId } }));
};
