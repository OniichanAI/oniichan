import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OniMascotComponent } from './oni-mascot.component';

type EmptyMood = 'happy' | 'serious' | 'dry' | 'angry';
type EmptySize = 'sm' | 'md' | 'lg';

/**
 * Standard empty-state surface. One component so every "nothing here" view
 * looks like it belongs to the same product — mascot + headline + helper
 * copy + optional action slot.
 */
@Component({
  selector: 'oni-empty',
  standalone: true,
  imports: [CommonModule, OniMascotComponent],
  styles: [':host { display: block; }'],
  template: `
    <div
      class="flex flex-col items-center justify-center text-center"
      [class.py-8]="size === 'sm'"
      [class.py-12]="size === 'md'"
      [class.py-16]="size === 'lg'"
    >
      <oni-mascot [size]="mascotSize()" [mood]="mood" />
      @if (title) {
        <h3 class="mt-4 text-base font-bold text-oni-ink-strong">{{ title }}</h3>
      }
      @if (message) {
        <p class="mx-auto mt-2 max-w-sm text-sm text-oni-ink-mute">{{ message }}</p>
      }
      <div class="mt-4">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class OniEmptyComponent {
  @Input() title?: string;
  @Input() message?: string;
  @Input() mood: EmptyMood = 'happy';
  @Input() size: EmptySize = 'md';

  mascotSize(): 'sm' | 'md' | 'lg' {
    return this.size === 'sm' ? 'sm' : this.size === 'lg' ? 'lg' : 'md';
  }
}
