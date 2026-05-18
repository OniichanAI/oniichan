import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:left-auto sm:right-6">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-oni-surface px-4 py-3"
          [class.border-rose-200]="toast.level === 'error'"
          [class.border-emerald-200]="toast.level === 'success'"
          [class.border-oni-border]="toast.level === 'info'"
          style="box-shadow: var(--shadow-oni-pop)"
        >
          <span
            class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
            [class.bg-oni-danger]="toast.level === 'error'"
            [class.bg-oni-success]="toast.level === 'success'"
            [class.bg-oni-ink-mute]="toast.level === 'info'"
          ></span>
          <p class="flex-1 text-sm text-oni-ink-strong">{{ toast.message }}</p>
          <button
            (click)="toastService.dismiss(toast.id)"
            class="text-oni-ink-mute transition hover:text-oni-primary-deep"
            aria-label="Dismiss"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  toastService = inject(ToastService);
}
