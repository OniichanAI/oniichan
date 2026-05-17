import { Injectable, signal } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export interface ModerationStats {
  totalActions: number;
  bans: number;
  kicks: number;
  mutes: number;
  trends: { date: string; count: number }[];
  suspiciousUsers: { id: string; username: string; score: number; reason: string }[];
}

@Injectable({
  providedIn: 'root',
})
export class ModerationService {
  private statsSignal = signal<ModerationStats | null>(null);
  stats = this.statsSignal.asReadonly();

  fetchStats(): void {
    // Mocking API call
    const mockStats: ModerationStats = {
      totalActions: 156,
      bans: 12,
      kicks: 24,
      mutes: 120,
      trends: [
        { date: '2026-05-11', count: 12 },
        { date: '2026-05-12', count: 18 },
        { date: '2026-05-13', count: 15 },
        { date: '2026-05-14', count: 22 },
        { date: '2026-05-15', count: 30 },
        { date: '2026-05-16', count: 25 },
        { date: '2026-05-17', count: 14 },
      ],
      suspiciousUsers: [
        { id: '1', username: 'spammer_99', score: 85, reason: 'Rapid message sending' },
        { id: '2', username: 'troll_face', score: 72, reason: 'Controversial language detected' },
        { id: '3', username: 'new_account_123', score: 64, reason: 'Immediate link sharing' },
      ],
    };

    of(mockStats).pipe(delay(500)).subscribe(stats => this.statsSignal.set(stats));
  }
}
