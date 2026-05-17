import { Injectable, signal } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  timestamp: Date;
  riskTier: 'low' | 'medium' | 'high';
  rationale: string;
  outcome: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private logsSignal = signal<AuditLogEntry[]>([]);
  logs = this.logsSignal.asReadonly();

  fetchLogs(): void {
    // Mocking API call
    const mockLogs: AuditLogEntry[] = [
      {
        id: '1',
        actor: 'AI Assistant',
        action: 'Ban User',
        timestamp: new Date(),
        riskTier: 'high',
        rationale: 'User detected sending malicious links in #general.',
        outcome: 'Success',
      },
      {
        id: '2',
        actor: 'Admin (ensui)',
        action: 'Create Channel',
        timestamp: new Date(Date.now() - 3600000),
        riskTier: 'medium',
        rationale: 'New project discussion.',
        outcome: 'Success',
      },
      {
        id: '3',
        actor: 'AI Assistant',
        action: 'Enable Slow Mode',
        timestamp: new Date(Date.now() - 7200000),
        riskTier: 'low',
        rationale: 'Rapid message burst detected.',
        outcome: 'Success',
      },
    ];

    of(mockLogs).pipe(delay(500)).subscribe(logs => this.logsSignal.set(logs));
  }
}
