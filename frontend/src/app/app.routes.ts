import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { tenantGuard } from './core/guards/tenant.guard';
import { bootstrapGuard } from './core/guards/bootstrap.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/callback/callback.component').then(m => m.CallbackComponent),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },
  {
    path: 'welcome',
    canActivate: [authGuard, tenantGuard],
    loadComponent: () => import('./features/welcome/welcome.component').then(m => m.WelcomeComponent),
  },
  {
    path: '',
    canActivate: [authGuard, tenantGuard, bootstrapGuard],
    loadComponent: () => import('./core/layout/app-shell/app-shell.component').then(m => m.AppShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'chatops',
        loadComponent: () => import('./features/chatops/chatops.component').then(m => m.ChatopsComponent),
      },
      {
        path: 'moderation',
        loadComponent: () => import('./features/moderation/moderation.component').then(m => m.ModerationComponent),
      },
      {
        path: 'audit',
        loadComponent: () => import('./features/audit/audit.component').then(m => m.AuditComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/autonomy-settings/autonomy-settings.component').then(m => m.AutonomySettingsComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
