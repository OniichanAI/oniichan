import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditEvent {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  event_type: string;
  risk_tier: 'low' | 'medium' | 'high' | string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditEventList {
  items: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditQuery {
  limit?: number;
  offset?: number;
  eventType?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private http = inject(HttpClient);

  list(query: AuditQuery = {}): Observable<AuditEventList> {
    let params = new HttpParams();
    if (query.limit != null) params = params.set('limit', String(query.limit));
    if (query.offset != null) params = params.set('offset', String(query.offset));
    if (query.eventType) params = params.set('event_type', query.eventType);
    return this.http.get<AuditEventList>('/api/v1/audit', { params });
  }
}
