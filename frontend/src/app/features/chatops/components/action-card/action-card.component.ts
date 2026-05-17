import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIAction } from '../../chat.model';
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
      <div class="flex items-center justify-between mb-3">
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          [class.bg-red-50]="action.risk_tier === 'high'"
          [class.text-red-700]="action.risk_tier === 'high'"
          [class.bg-orange-50]="action.risk_tier === 'medium'"
          [class.text-orange-700]="action.risk_tier === 'medium'"
          [class.bg-slate-50]="action.risk_tier === 'low'"
          [class.text-slate-700]="action.risk_tier === 'low'"
        >
          {{ action.risk_tier }} Risk
        </span>
        
        <span *ngIf="action.outcome" class="text-[10px] font-medium text-green-600">
          ✓ Executed
        </span>
      </div>

      <p class="text-sm font-medium text-slate-800">{{ action.description }}</p>

      <div *ngIf="!action.outcome" class="mt-4 flex gap-2">
        <app-button
          variant="primary"
          size="sm"
          [loading]="status === 'executing'"
          (click)="confirm.emit()"
        >
          Confirm
        </app-button>
        <app-button
          variant="secondary"
          size="sm"
          [disabled]="status === 'executing'"
          (click)="cancel.emit()"
        >
          Cancel
        </app-button>
      </div>

      <div *ngIf="action.outcome" class="mt-3 rounded-lg bg-green-50 p-2 text-xs text-green-700">
        {{ action.outcome }}
      </div>
    </div>
  `,
})
export class ActionCardComponent {
  @Input({ required: true }) action!: AIAction;
  @Input() status?: string;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
