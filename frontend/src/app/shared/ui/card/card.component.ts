import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="cardClasses">
      <div *ngIf="title" class="mb-4">
        <h3 class="text-lg font-bold text-oni-ink-strong">{{ title }}</h3>
        <p *ngIf="subtitle" class="mt-1 text-sm text-oni-ink">{{ subtitle }}</p>
      </div>
      <ng-content></ng-content>
    </div>
  `,
  // Without a block host, Tailwind's space-y-* margins are ignored on
  // sibling app-cards (custom elements default to inline).
  styles: [':host { display: block; }'],
})
export class CardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  @Input() hoverable = false;

  get cardClasses(): string {
    const base = 'rounded-3xl border border-oni-border bg-oni-surface transition-all';
    const pad = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' }[this.padding];
    const shadow = '[box-shadow:var(--shadow-oni-soft)]';
    const hover = this.hoverable
      ? 'hover:border-oni-primary [&:hover]:[box-shadow:var(--shadow-oni-pop)]'
      : '';
    return `${base} ${pad} ${shadow} ${hover}`.trim();
  }
}
