import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHostComponent } from './core/feedback/toast.component';
import { ThemeService } from './core/branding/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = 'Oniichan · Discord Ops';

  // Instantiating ThemeService at bootstrap ensures the persisted theme is
  // applied on every route — including ones that don't otherwise inject it
  // (login, onboarding, callback). Without this, a hard refresh on those
  // routes would render in light mode regardless of saved preference.
  private readonly _theme = inject(ThemeService);
}
