import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="cardClasses">
      <div *ngIf="title" class="mb-4">
        <h3 class="text-lg font-bold text-slate-900">{{ title }}</h3>
        <p *ngIf="subtitle" class="text-sm text-slate-500">{{ subtitle }}</p>
      </div>
      <ng-content></ng-content>
    </div>
  `,
})
export class CardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  @Input() hoverable = false;

  get cardClasses(): string {
    const baseClasses = 'rounded-3xl border border-slate-200 bg-white shadow-sm transition-all';
    
    const paddingClasses = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const hoverClasses = this.hoverable ? 'hover:shadow-md hover:border-slate-300' : '';

    return `${baseClasses} ${paddingClasses[this.padding]} ${hoverClasses}`;
  }
}
