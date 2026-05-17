import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PendingAction } from '../../chat.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-action-card',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div
      class="rounded-2xl border bg-white p-4 shadow-sm"
      [class.border-red-100]="action.risk_tier === 'high'"
      [class.border-orange-100]="action.risk_tier === 'medium'"
      [class.border-slate-100]="action.risk_tier === 'low'"
    >
      <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            [class.bg-red-50]="action.risk_tier === 'high'"
            [class.text-red-700]="action.risk_tier === 'high'"
            [class.bg-orange-50]="action.risk_tier === 'medium'"
            [class.text-orange-700]="action.risk_tier === 'medium'"
            [class.bg-slate-100]="action.risk_tier === 'low'"
            [class.text-slate-700]="action.risk_tier === 'low'"
          >
            {{ action.risk_tier }} risk
          </span>
          <span class="font-mono text-[10px] text-slate-400">{{ action.kind }}</span>
        </div>

        @if (action.status === 'executed') {
          <span class="text-[10px] font-semibold uppercase text-green-600">✓ Executed</span>
        } @else if (action.status === 'cancelled') {
          <span class="text-[10px] font-semibold uppercase text-slate-500">Cancelled</span>
        } @else if (action.status === 'expired') {
          <span class="text-[10px] font-semibold uppercase text-slate-400">Expired</span>
        }
      </div>

      <p class="text-sm font-medium text-slate-800">{{ action.summary }}</p>

      @if (paramKeys().length > 0) {
        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          @for (key of paramKeys(); track key) {
            <dt class="text-slate-400">{{ key }}</dt>
            <dd class="font-mono text-slate-700">{{ paramValue(key) }}</dd>
          }
        </dl>
      }

      @if (action.status === 'pending') {
        <div class="mt-4 flex gap-2">
          <app-button variant="primary" size="sm" [loading]="busy" (click)="confirm.emit()">
            Confirm
          </app-button>
          <app-button variant="secondary" size="sm" [disabled]="busy" (click)="cancel.emit()">
            Cancel
          </app-button>
        </div>
      } @else if (action.receipt) {
        <div class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {{ receiptNote() }}
        </div>
      }
    </div>
  `,
})
export class ActionCardComponent {
  @Input({ required: true }) action!: PendingAction;
  @Input() busy = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  paramKeys(): string[] {
    return Object.keys(this.action.params ?? {});
  }

  paramValue(key: string): string {
    const v = this.action.params[key];
    if (v == null) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  receiptNote(): string {
    const note = this.action.receipt?.['note'];
    if (typeof note === 'string') return note;
    return 'Recorded.';
  }
}
