import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PendingAction } from '../../chat.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { OniIconComponent } from '../../../../core/branding/oni-icon.component';
import { ONI } from '../../../../core/branding/microcopy';

@Component({
  selector: 'app-action-card',
  standalone: true,
  imports: [CommonModule, ButtonComponent, OniIconComponent],
  template: `
    <div
      class="rounded-2xl border bg-oni-surface p-4"
      [class.border-oni-danger]="action.risk_tier === 'high'"
      [class.border-oni-warn]="action.risk_tier === 'medium'"
      [class.border-oni-border]="action.risk_tier === 'low'"
      style="box-shadow: var(--shadow-oni-soft)"
    >
      <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            [class.bg-oni-danger-soft]="action.risk_tier === 'high'"
            [class.text-oni-danger]="action.risk_tier === 'high'"
            [class.bg-oni-warn-soft]="action.risk_tier === 'medium'"
            [class.text-oni-warn]="action.risk_tier === 'medium'"
            [class.bg-oni-surface-mute]="action.risk_tier === 'low'"
            [class.text-oni-ink-mute]="action.risk_tier === 'low'"
          >
            {{ action.risk_tier }} risk
          </span>
          <span class="font-mono text-[10px] text-oni-ink-mute">{{ action.kind }}</span>
        </div>

        @if (action.status === 'executed') {
          <span class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-oni-success">
            <oni-icon name="check" [size]="12" [strokeWidth]="2.5" />
            {{ copy.chatops.statusExecuted }}
          </span>
        } @else if (action.status === 'cancelled') {
          <span class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-oni-ink-mute">
            <oni-icon name="x" [size]="12" />
            {{ copy.chatops.statusCancelled }}
          </span>
        } @else if (action.status === 'expired') {
          <span class="text-[10px] font-semibold uppercase text-oni-ink-mute">{{ copy.chatops.statusExpired }}</span>
        }
      </div>

      <p class="text-sm font-medium text-oni-ink-strong">{{ action.summary }}</p>

      @if (paramKeys().length > 0) {
        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          @for (key of paramKeys(); track key) {
            <dt class="text-oni-ink-mute">{{ key }}</dt>
            <dd class="font-mono text-oni-ink-strong">{{ paramValue(key) }}</dd>
          }
        </dl>
      }

      @if (action.status === 'pending') {
        <div class="mt-4 flex gap-2">
          <app-button variant="primary" size="sm" [loading]="busy" (click)="confirm.emit()">
            {{ copy.chatops.confirm }}
          </app-button>
          <app-button variant="secondary" size="sm" [disabled]="busy" (click)="cancel.emit()">
            {{ copy.chatops.cancel }}
          </app-button>
        </div>
      } @else if (action.receipt) {
        <div
          class="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px]"
          [class.bg-oni-success-soft]="receiptKind() === 'live-ok'"
          [class.text-oni-success]="receiptKind() === 'live-ok'"
          [class.bg-oni-danger-soft]="receiptKind() === 'live-fail'"
          [class.text-oni-danger]="receiptKind() === 'live-fail'"
          [class.bg-oni-surface-mute]="receiptKind() === 'dry'"
          [class.text-oni-ink]="receiptKind() === 'dry'"
        >
          <span class="font-semibold uppercase tracking-wider">{{ receiptLabel() }}</span>
          <span>·</span>
          <span class="flex-1">{{ receiptNote() }}</span>
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
  readonly copy = ONI;

  paramKeys(): string[] {
    return Object.keys(this.action.params ?? {});
  }

  paramValue(key: string): string {
    const v = this.action.params[key];
    if (v == null) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  /** Tagged kind we render against — keeps templating logic out of getters. */
  receiptKind(): 'live-ok' | 'live-fail' | 'dry' {
    const r = this.action.receipt;
    if (!r) return 'dry';
    if (r['mode'] === 'live' && r['ok'] === true) return 'live-ok';
    if (r['mode'] === 'live') return 'live-fail';
    return 'dry';
  }

  receiptLabel(): string {
    switch (this.receiptKind()) {
      case 'live-ok':
        return 'Live';
      case 'live-fail':
        return 'Failed';
      default:
        return 'Dry-run';
    }
  }

  receiptNote(): string {
    const r = this.action.receipt;
    const rawNote = typeof r?.['note'] === 'string' ? (r!['note'] as string) : '';
    switch (this.receiptKind()) {
      case 'live-ok':
        return this.copy.receipts.liveOk;
      case 'live-fail':
        return this.copy.receipts.liveFailed(rawNote || 'Check the audit log for details.');
      default:
        return rawNote
          ? this.copy.receipts.dryRunReason(this.extractReason(rawNote))
          : 'Recorded only.';
    }
  }

  /**
   * Backend dry-run notes look like "Recorded only — <reason>. Enable execution …"
   * Strip the boilerplate so the branded wrapper doesn't double up.
   */
  private extractReason(rawNote: string): string {
    const match = rawNote.match(/—\s*(.+?)\./);
    return match ? match[1].trim() : rawNote;
  }
}
