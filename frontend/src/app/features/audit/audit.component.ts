import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditEvent, AuditEventList, AuditService } from './audit.service';
import { CardComponent } from '../../shared/ui/card/card.component';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent],
  template: `
    <div class="space-y-6">
      <app-card title="Audit Log" subtitle="Every action taken in this server, AI or human.">
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Filter by event type (e.g. tenant.provisioned)"
            class="flex-1 min-w-[240px] rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#5865F2] focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
            [ngModel]="filter()"
            (ngModelChange)="onFilterChange($event)"
          />
          <button
            (click)="reload()"
            [disabled]="loading()"
            class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
          >
            {{ loading() ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </app-card>

      <div class="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        @if (loading() && events().length === 0) {
          <div class="flex items-center justify-center py-16 text-slate-400">
            <div class="h-6 w-6 animate-spin rounded-full border-4 border-solid border-[#5865F2] border-r-transparent"></div>
            <span class="ml-3 text-sm">Loading events...</span>
          </div>
        } @else if (events().length === 0) {
          <div class="px-6 py-16 text-center text-sm text-slate-500">
            No audit events yet. Install the bot on a server to generate the first event.
          </div>
        } @else {
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-6 py-4">Event</th>
                <th class="px-6 py-4">Risk</th>
                <th class="px-6 py-4">Summary</th>
                <th class="px-6 py-4">Time</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (event of events(); track event.id) {
                <tr class="transition hover:bg-slate-50">
                  <td class="px-6 py-4">
                    <span class="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                      {{ event.event_type }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      [class.bg-red-50]="event.risk_tier === 'high'"
                      [class.text-red-700]="event.risk_tier === 'high'"
                      [class.bg-orange-50]="event.risk_tier === 'medium'"
                      [class.text-orange-700]="event.risk_tier === 'medium'"
                      [class.bg-slate-100]="event.risk_tier === 'low'"
                      [class.text-slate-700]="event.risk_tier === 'low'"
                    >
                      {{ event.risk_tier }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-slate-700">{{ event.summary }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-slate-400">
                    {{ event.created_at | date:'medium' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3 text-xs text-slate-500">
            <span>
              Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ total() }}
            </span>
            <div class="flex gap-2">
              <button
                (click)="prev()"
                [disabled]="offset() === 0 || loading()"
                class="rounded-lg border border-slate-200 px-3 py-1 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                (click)="next()"
                [disabled]="!hasNext() || loading()"
                class="rounded-lg border border-slate-200 px-3 py-1 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class AuditComponent implements OnInit {
  private auditService = inject(AuditService);

  events = signal<AuditEvent[]>([]);
  total = signal(0);
  offset = signal(0);
  loading = signal(false);
  filter = signal('');

  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  rangeStart = computed(() => (this.total() === 0 ? 0 : this.offset() + 1));
  rangeEnd = computed(() => Math.min(this.total(), this.offset() + this.events().length));
  hasNext = computed(() => this.offset() + this.events().length < this.total());

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.fetch();
  }

  onFilterChange(value: string): void {
    this.filter.set(value);
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => {
      this.offset.set(0);
      this.fetch();
    }, 250);
  }

  next(): void {
    if (!this.hasNext()) return;
    this.offset.update((v) => v + PAGE_SIZE);
    this.fetch();
  }

  prev(): void {
    if (this.offset() === 0) return;
    this.offset.update((v) => Math.max(0, v - PAGE_SIZE));
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    this.auditService
      .list({ limit: PAGE_SIZE, offset: this.offset(), eventType: this.filter() || undefined })
      .subscribe({
        next: (result: AuditEventList) => {
          this.events.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
