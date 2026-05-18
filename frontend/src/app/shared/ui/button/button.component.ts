import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [disabled]="disabled || loading"
      [class]="buttonClasses"
      (click)="onClick($event)"
    >
      <div
        *ngIf="loading"
        class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"
      ></div>
      <ng-content></ng-content>
    </button>
  `,
})
export class ButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled = false;
  @Input() loading = false;

  get buttonClasses(): string {
    const base =
      'inline-flex items-center justify-center whitespace-nowrap rounded-2xl font-semibold ' +
      'transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ' +
      'disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      primary: 'bg-oni-primary text-white hover:bg-oni-primary-deep focus:ring-oni-primary',
      secondary:
        'bg-oni-surface border border-oni-border text-oni-ink-strong hover:border-oni-primary focus:ring-oni-primary',
      danger: 'bg-oni-danger text-white hover:bg-oni-danger-deep focus:ring-oni-danger',
      ghost: 'bg-transparent text-oni-ink hover:bg-oni-surface-mute focus:ring-oni-border-strong',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return `${base} ${variantClasses[this.variant]} ${sizeClasses[this.size]}`;
  }

  onClick(event: MouseEvent): void {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
