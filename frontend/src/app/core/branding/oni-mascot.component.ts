import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type MascotSize = 'xs' | 'sm' | 'md' | 'lg';
type MascotMood = 'happy' | 'serious' | 'dry' | 'angry';

/**
 * Pure-CSS mascot face. Lives behind a single component so the visual treatment
 * (gradient, eyes, mouth, mode badge) can be tuned in one place — no real
 * mascot art assets to ship until we feel like it.
 */
@Component({
  selector: 'oni-mascot',
  standalone: true,
  imports: [CommonModule],
  styles: [':host { display: inline-flex; }'],
  template: `
    <span
      class="relative inline-flex shrink-0 items-center justify-center rounded-full text-white font-display font-bold"
      [class.h-6]="size === 'xs'"
      [class.w-6]="size === 'xs'"
      [class.text-[10px]]="size === 'xs'"
      [class.h-8]="size === 'sm'"
      [class.w-8]="size === 'sm'"
      [class.text-xs]="size === 'sm'"
      [class.h-10]="size === 'md'"
      [class.w-10]="size === 'md'"
      [class.text-sm]="size === 'md'"
      [class.h-14]="size === 'lg'"
      [class.w-14]="size === 'lg'"
      [class.text-base]="size === 'lg'"
      [style.background]="background()"
      [style.boxShadow]="'var(--shadow-oni-pop)'"
      [attr.aria-label]="'Onii-chan'"
      title="Onii-chan"
    >
      <span class="select-none leading-none">{{ face() }}</span>
      @if (live) {
        <span
          class="absolute -bottom-0.5 -right-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-oni-success ring-2 ring-white"
          [class.h-3.5]="size === 'md' || size === 'lg'"
          [class.w-3.5]="size === 'md' || size === 'lg'"
          aria-label="Live execution enabled"
          title="Live execution enabled"
        ></span>
      }
    </span>
  `,
})
export class OniMascotComponent {
  @Input() size: MascotSize = 'md';
  @Input() mood: MascotMood = 'happy';
  /** If true, paints a small accent dot meaning "I'm allowed to actually act". */
  @Input() live = false;

  face(): string {
    switch (this.mood) {
      case 'angry':
        return '`_´';
      case 'serious':
        return '·_·';
      case 'dry':
        return '⩌_⩌';
      default:
        return '◕‿◕';
    }
  }

  background(): string {
    switch (this.mood) {
      case 'angry':
        return 'linear-gradient(135deg, #e11d48 0%, #6d28d9 100%)';
      case 'serious':
        return 'linear-gradient(135deg, #6d28d9 0%, #d14a89 100%)';
      case 'dry':
        return 'linear-gradient(135deg, #9d8aa6 0%, #d14a89 100%)';
      default:
        return 'linear-gradient(135deg, #ff7ab6 0%, #d14a89 100%)';
    }
  }
}
