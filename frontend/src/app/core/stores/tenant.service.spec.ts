import { TestBed } from '@angular/core/testing';
import { TenantService } from './tenant.service';
import { Tenant } from '../http/tenant.model';

const t = (id: string, name = `tenant-${id}`): Tenant => ({
  id,
  name,
  slug: name,
  is_active: true,
});

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TenantService);
  });

  it('starts with no selection', () => {
    expect(service.tenants()).toEqual([]);
    expect(service.hasTenant()).toBe(false);
    expect(service.getTenantId()).toBeNull();
  });

  it('remembers the last selection across a re-hydrate', () => {
    const a = t('aaa');
    const b = t('bbb');
    service.setTenants([a, b]);
    service.setTenant(b);

    // simulate a page reload by resetting TestBed — localStorage persists
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(TenantService);
    fresh.setTenants([a, b]);

    expect(fresh.getTenantId()).toBe('bbb');
  });

  it('drops the current selection when it disappears from the server', () => {
    const a = t('aaa');
    service.setTenants([a]);
    service.setTenant(a);
    service.setTenants([]); // tenant removed elsewhere
    expect(service.hasTenant()).toBe(false);
    expect(localStorage.getItem('last_tenant_id')).toBeNull();
  });

  it('clear() wipes both memory and localStorage', () => {
    service.setTenants([t('x')]);
    service.setTenant(t('x'));
    service.clear();
    expect(service.tenants()).toEqual([]);
    expect(service.hasTenant()).toBe(false);
    expect(localStorage.getItem('last_tenant_id')).toBeNull();
  });
});
