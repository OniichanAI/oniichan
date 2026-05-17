import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditService } from './audit.service';
import { CardComponent } from '../../shared/ui/card/card.component';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <div class="space-y-6">
      <app-card title="Audit Log" subtitle="A detailed history of all actions taken in your server.">
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">All Time</button>
          <button class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">High Risk Only</button>
          <button class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">AI Actions</button>
        </div>
      </app-card>

      <div class="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
            <tr>
              <th class="px-6 py-4">Actor</th>
              <th class="px-6 py-4">Action</th>
              <th class="px-6 py-4">Risk</th>
              <th class="px-6 py-4">Rationale</th>
              <th class="px-6 py-4">Time</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (log of auditService.logs(); track log.id) {
              <tr class="hover:bg-slate-50 transition-all">
                <td class="px-6 py-4 font-medium text-slate-900">{{ log.actor }}</td>
                <td class="px-6 py-4">
                  <span class="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {{ log.action }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    [class.bg-red-50]="log.riskTier === 'high'"
                    [class.text-red-700]="log.riskTier === 'high'"
                    [class.bg-orange-50]="log.riskTier === 'medium'"
                    [class.text-orange-700]="log.riskTier === 'medium'"
                    [class.bg-slate-50]="log.riskTier === 'low'"
                    [class.text-slate-700]="log.riskTier === 'low'"
                  >
                    {{ log.riskTier }}
                  </span>
                </td>
                <td class="px-6 py-4 text-slate-500 max-w-md truncate">{{ log.rationale }}</td>
                <td class="px-6 py-4 text-slate-400 whitespace-nowrap">{{ log.timestamp | date:'short' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AuditComponent implements OnInit {
  auditService = inject(AuditService);

  ngOnInit(): void {
    this.auditService.fetchLogs();
  }
}
