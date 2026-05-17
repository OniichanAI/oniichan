import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../shared/ui/card/card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <div class="space-y-6">
      <app-card title="Dashboard" subtitle="Welcome to your AI-powered Discord moderation hub." padding="lg">
      </app-card>

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <app-card padding="md">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Members</h3>
          <p class="mt-2 text-3xl font-bold text-slate-900">1,248</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Active Today</h3>
          <p class="mt-2 text-3xl font-bold text-slate-900">412</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Mod Actions</h3>
          <p class="mt-2 text-3xl font-bold text-slate-900">12</p>
        </app-card>
      </div>
    </div>
  `,
})
export class DashboardComponent {}
