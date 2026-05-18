import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditEvent, AuditEventList, AuditService } from './audit.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { OniEmptyComponent } from '../../core/branding/oni-empty.component';
import { OniIconComponent } from '../../core/branding/oni-icon.component';
import { ONI } from '../../core/branding/microcopy';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, OniEmptyComponent, OniIconComponent],
  template: `
    <div class="space-y-8">
      <app-card [title]="copy.audit.title" [subtitle]="copy.audit.sub">
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            [placeholder]="copy.audit.filterPlaceholder"
            class="min-w-[260px] flex-1 rounded-2xl border border-oni-border bg-oni-surface px-4 py-2 text-sm text-oni-ink placeholder:text-oni-ink-mute focus:border-oni-primary focus:outline-none focus:ring-2 focus:ring-oni-primary/30"
            [ngModel]="filter()"
            (ngModelChange)="onFilterChange($event)"
          />
          <button
            (click)="reload()"
            [disabled]="loading()"
            class="inline-flex items-center gap-2 rounded-2xl border border-oni-border bg-oni-surface px-4 py-2 text-sm font-medium text-oni-ink-strong transition hover:border-oni-primary disabled:opacity-50"
          >
            <oni-icon name="refresh-cw" [size]="14" />
            {{ loading() ? copy.audit.refreshing : copy.audit.refresh }}
          </button>
        </div>
      </app-card>

      <div
        class="overflow-hidden rounded-3xl border border-oni-border bg-oni-surface"
        style="box-shadow: var(--shadow-oni-soft)"
      >
        @if (loading() && events().length === 0) {
          <div class="flex items-center justify-center py-16 text-oni-ink-mute">
            <div class="h-6 w-6 animate-spin rounded-full border-4 border-solid border-oni-primary border-r-transparent"></div>
            <span class="ml-3 text-sm">{{ copy.audit.loading }}</span>
          </div>
        } @else if (events().length === 0) {
          <oni-empty
            class="px-6"
            mood="dry"
            size="lg"
            title="Suspiciously quiet"
            [message]="copy.audit.empty"
          />
        } @else {
        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="bg-oni-surface-mute text-[10px] font-semibold uppercase tracking-wider text-oni-ink-mute">
              <tr>
                <th class="px-6 py-4">{{ copy.audit.headers.event }}</th>
                <th class="px-6 py-4">{{ copy.audit.headers.risk }}</th>
                <th class="px-6 py-4">{{ copy.audit.headers.summary }}</th>
                <th class="px-6 py-4">{{ copy.audit.headers.time }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-oni-border">
              @for (event of events(); track event.id) {
                <tr class="transition hover:bg-oni-surface-mute">
                  <td class="px-6 py-4">
                    <span class="rounded-lg bg-oni-surface-mute px-2 py-1 font-mono text-xs text-oni-ink-strong">
                      {{ event.event_type }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      [class.bg-oni-danger-soft]="event.risk_tier === 'high'"
                      [class.text-oni-danger]="event.risk_tier === 'high'"
                      [class.bg-oni-warn-soft]="event.risk_tier === 'medium'"
                      [class.text-oni-warn]="event.risk_tier === 'medium'"
                      [class.bg-oni-surface-mute]="event.risk_tier === 'low'"
                      [class.text-oni-ink-mute]="event.risk_tier === 'low'"
                    >
                      {{ event.risk_tier }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-oni-ink">{{ event.summary }}</td>
                  <td class="whitespace-nowrap px-6 py-4 text-oni-ink-mute">
                    {{ event.created_at | date:'medium' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-oni-border bg-oni-surface-mute px-4 py-3 text-xs text-oni-ink-mute sm:px-6">
            <span>Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ total() }}</span>
            <div class="flex gap-2">
              <button
                (click)="prev()"
                [disabled]="offset() === 0 || loading()"
                class="rounded-lg border border-oni-border bg-oni-surface px-3 py-1 transition hover:border-oni-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                (click)="next()"
                [disabled]="!hasNext() || loading()"
                class="rounded-lg border border-oni-border bg-oni-surface px-3 py-1 transition hover:border-oni-primary disabled:cursor-not-allowed disabled:opacity-40"
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
  readonly copy = ONI;

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
