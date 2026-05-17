import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TenantService } from '../../stores/tenant.service';
import { SettingsService } from '../../stores/settings.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-slate-50">
      <!-- Sidebar -->
      <aside class="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div class="flex h-16 items-center px-6">
          <span class="text-xl font-bold tracking-tight text-slate-900">AI Discord Ops</span>
        </div>

        <nav class="flex-1 space-y-1 px-3 py-4">
          <a
            routerLink="/dashboard"
            routerLinkActive="bg-slate-100 text-[#5865F2]"
            class="group flex items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <svg class="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </a>

          <a
            routerLink="/chatops"
            routerLinkActive="bg-slate-100 text-[#5865F2]"
            class="group flex items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <svg class="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            ChatOps
          </a>

          <div class="my-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Management</div>

          <a
            routerLink="/moderation"
            routerLinkActive="bg-slate-100 text-[#5865F2]"
            class="group flex items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <svg class="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Moderation
          </a>

          <a
            routerLink="/audit"
            routerLinkActive="bg-slate-100 text-[#5865F2]"
            class="group flex items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <svg class="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Audit Log
          </a>

          <a
            routerLink="/settings"
            routerLinkActive="bg-slate-100 text-[#5865F2]"
            class="group flex items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <svg class="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </a>
        </nav>

        <div class="border-t border-slate-200 p-4">
          <div class="flex items-center gap-3">
            <div class="h-8 w-8 rounded-full bg-slate-200"></div>
            <div class="flex-1 overflow-hidden">
              <p class="truncate text-sm font-medium text-slate-900">{{ authService.user()?.username }}</p>
              <button (click)="onLogout()" class="text-xs text-slate-500 hover:text-slate-700">Logout</button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Top Header -->
        <header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div class="flex items-center gap-4">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">
              {{ tenantService.currentTenant()?.name?.charAt(0) }}
            </div>
            <h2 class="text-sm font-semibold text-slate-900">{{ tenantService.currentTenant()?.name }}</h2>
            <button routerLink="/onboarding" class="text-xs text-[#5865F2] hover:underline">Switch</button>
          </div>

          <div class="flex items-center gap-3">
            @if (settingsService.killSwitch()) {
              <a
                routerLink="/settings"
                class="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-700 ring-1 ring-inset ring-red-600/30 hover:bg-red-100"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                Kill switch
              </a>
            } @else if (settingsService.execution()) {
              <span class="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                Live execution
              </span>
            } @else {
              <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300/40">
                <span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                Dry-run
              </span>
            }
          </div>
        </header>

        <!-- Scrollable content -->
        <main class="flex-1 overflow-y-auto p-8">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent implements OnInit {
  tenantService = inject(TenantService);
  settingsService = inject(SettingsService);
  authService = inject(AuthService);

  ngOnInit(): void {
    // Refresh the user + tenants on entry so a stale tab picks up changes.
    this.authService.checkAuth().subscribe();
    // Hydrate tenant settings so the kill-switch badge reflects current state.
    this.settingsService.load().subscribe();
  }

  onLogout(): void {
    this.settingsService.clear();
    this.authService.logout();
  }
}
