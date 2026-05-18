import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OniMascotComponent } from './oni-mascot.component';

type WordmarkSize = 'sm' | 'md' | 'lg';

/**
 * The Oniichan lockup: mascot + brand name. Single component so the brand mark
 * never drifts across surfaces. No SVG dependency — the type lockup uses the
 * brand font (Fredoka) with a system fallback baked into --font-brand.
 */
@Component({
  selector: 'oni-wordmark',
  standalone: true,
  imports: [CommonModule, OniMascotComponent],
  styles: [':host { display: inline-flex; }'],
  template: `
    <span class="inline-flex items-center gap-2.5 select-none">
      <oni-mascot [size]="mascotSize()" />
      <span class="flex flex-col leading-none">
        <span
          class="font-brand font-bold tracking-tight text-oni-ink-strong"
          [class.text-base]="size === 'sm'"
          [class.text-lg]="size === 'md'"
          [class.text-2xl]="size === 'lg'"
        >
          Oniichan
        </span>
        @if (showTagline) {
          <span class="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-oni-ink-mute">
            Discord ops
          </span>
        }
      </span>
    </span>
  `,
})
export class OniWordmarkComponent {
  @Input() size: WordmarkSize = 'md';
  @Input() showTagline = false;

  mascotSize(): 'xs' | 'sm' | 'md' | 'lg' {
    switch (this.size) {
      case 'sm':
        return 'sm';
      case 'lg':
        return 'lg';
      default:
        return 'md';
    }
  }
}
