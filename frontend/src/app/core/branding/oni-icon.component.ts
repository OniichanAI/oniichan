import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type OniIconName =
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'check'
  | 'x'
  | 'arrow-right'
  | 'home'
  | 'message-square'
  | 'shield'
  | 'file-text'
  | 'settings'
  | 'log-out'
  | 'plus'
  | 'refresh-cw'
  | 'chevron-down'
  | 'chevron-up'
  | 'server'
  | 'alert-triangle'
  | 'send'
  | 'menu'
  | 'panel-left-close'
  | 'panel-left-open';

/**
 * Tiny inline-SVG icon registry. Paths are lifted verbatim from Lucide
 * (https://lucide.dev/) which is what shadcn/ui ships with — so the visual
 * weight matches modern dashboards without pulling in the full lucide-angular
 * package. Add new icons here, never inline raw SVG in feature templates.
 *
 * Defaults: 16px, currentColor, 2px stroke. Caller controls colour via the
 * surrounding text-* class; size via `size` input or Tailwind h-/w- on host.
 */
@Component({
  selector: 'oni-icon',
  standalone: true,
  imports: [CommonModule],
  styles: [':host { display: inline-flex; align-items: center; justify-content: center; }'],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.aria-hidden]="label ? null : 'true'"
      [attr.role]="label ? 'img' : null"
      [attr.aria-label]="label || null"
    >
      <ng-container [ngSwitch]="name">
        <ng-container *ngSwitchCase="'sun'">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </ng-container>

        <ng-container *ngSwitchCase="'moon'">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </ng-container>

        <ng-container *ngSwitchCase="'monitor'">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </ng-container>

        <ng-container *ngSwitchCase="'check'">
          <path d="M20 6 9 17l-5-5" />
        </ng-container>

        <ng-container *ngSwitchCase="'x'">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </ng-container>

        <ng-container *ngSwitchCase="'arrow-right'">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </ng-container>

        <ng-container *ngSwitchCase="'home'">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </ng-container>

        <ng-container *ngSwitchCase="'message-square'">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </ng-container>

        <ng-container *ngSwitchCase="'shield'">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </ng-container>

        <ng-container *ngSwitchCase="'file-text'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </ng-container>

        <ng-container *ngSwitchCase="'settings'">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </ng-container>

        <ng-container *ngSwitchCase="'log-out'">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </ng-container>

        <ng-container *ngSwitchCase="'plus'">
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </ng-container>

        <ng-container *ngSwitchCase="'refresh-cw'">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </ng-container>

        <ng-container *ngSwitchCase="'chevron-down'">
          <path d="m6 9 6 6 6-6" />
        </ng-container>

        <ng-container *ngSwitchCase="'chevron-up'">
          <path d="m18 15-6-6-6 6" />
        </ng-container>

        <ng-container *ngSwitchCase="'server'">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </ng-container>

        <ng-container *ngSwitchCase="'alert-triangle'">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </ng-container>

        <ng-container *ngSwitchCase="'send'">
          <path d="m22 2-7 20-4-9-9-4z" />
          <path d="M22 2 11 13" />
        </ng-container>

        <ng-container *ngSwitchCase="'menu'">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </ng-container>

        <ng-container *ngSwitchCase="'panel-left-close'">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <path d="m16 15-3-3 3-3" />
        </ng-container>

        <ng-container *ngSwitchCase="'panel-left-open'">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <path d="m14 9 3 3-3 3" />
        </ng-container>
      </ng-container>
    </svg>
  `,
})
export class OniIconComponent {
  @Input({ required: true }) name!: OniIconName;
  /** Pixel size (defaults to 16px). */
  @Input() size = 16;
  @Input() strokeWidth = 2;
  /** If set, the icon is exposed to assistive tech with this label. */
  @Input() label?: string;
}
