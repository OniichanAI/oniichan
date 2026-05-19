import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeMode, ThemeService } from './theme.service';
import { OniIconComponent } from './oni-icon.component';

/**
 * Compact theme cycler. One button, three states (light → dark → system).
 * Lives next to the status badge in the app shell, but works anywhere — no
 * inputs.
 */
@Component({
  selector: 'oni-theme-toggle',
  standalone: true,
  imports: [CommonModule, OniIconComponent],
  styles: [':host { display: inline-flex; }'],
  template: `
    <button
      type="button"
      (click)="theme.toggle()"
      class="inline-flex items-center gap-2 rounded-full border border-oni-border bg-oni-surface px-3 py-1.5 text-xs font-medium text-oni-ink-strong transition hover:border-oni-primary hover:text-oni-primary-deep"
      [attr.aria-label]="ariaLabel()"
      [title]="title()"
    >
      <oni-icon [name]="iconName()" [size]="14" />
      <span class="hidden sm:inline">{{ label() }}</span>
    </button>
  `,
})
export class ThemeToggleComponent {
  theme = inject(ThemeService);

  iconName(): 'sun' | 'moon' | 'monitor' {
    switch (this.theme.mode()) {
      case 'dark':
        return 'moon';
      case 'system':
        return 'monitor';
      default:
        return 'sun';
    }
  }

  label(): string {
    return this.labelFor(this.theme.mode());
  }

  title(): string {
    return `Theme: ${this.labelFor(this.theme.mode())} (click to cycle)`;
  }

  ariaLabel(): string {
    return `Toggle theme. Currently ${this.labelFor(this.theme.mode())}.`;
  }

  private labelFor(mode: ThemeMode): string {
    switch (mode) {
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
      default:
        return 'Light';
    }
  }
}
