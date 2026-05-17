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
      <div *ngIf="loading" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
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
    const baseClasses = 'inline-flex items-center justify-center rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'bg-[#5865F2] text-white hover:bg-[#4752C4] focus:ring-[#5865F2]',
      secondary: 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 focus:ring-slate-200',
      danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-100',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return `${baseClasses} ${variantClasses[this.variant]} ${sizeClasses[this.size]}`;
  }

  onClick(event: MouseEvent): void {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
