import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-6 sm:left-auto">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg"
          [class.border-red-200]="toast.level === 'error'"
          [class.border-green-200]="toast.level === 'success'"
          [class.border-slate-200]="toast.level === 'info'"
        >
          <span
            class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
            [class.bg-red-500]="toast.level === 'error'"
            [class.bg-green-500]="toast.level === 'success'"
            [class.bg-slate-400]="toast.level === 'info'"
          ></span>
          <p class="flex-1 text-sm text-slate-800">{{ toast.message }}</p>
          <button
            (click)="toastService.dismiss(toast.id)"
            class="text-slate-400 transition hover:text-slate-700"
            aria-label="Dismiss"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
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
