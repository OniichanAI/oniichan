import { Tenant } from '../http/tenant.model';

export interface User {
  discord_user_id: string;
  username: string;
  global_name: string | null;
  avatar_hash: string | null;
}

export interface Me {
  user: User;
  tenants: Tenant[];
}
