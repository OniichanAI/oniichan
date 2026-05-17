import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModerationService } from './moderation.service';
import { CardComponent } from '../../shared/ui/card/card.component';

@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <div class="space-y-6">
      <app-card title="Moderation Overview" subtitle="Monitor and manage server moderation activities.">
      </app-card>

      <!-- Stats Grid -->
      <div class="grid gap-6 md:grid-cols-4">
        <app-card padding="md">
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Actions</h3>
          <p class="mt-2 text-2xl font-bold text-slate-900">{{ stats()?.totalActions || 0 }}</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bans</h3>
          <p class="mt-2 text-2xl font-bold text-red-600">{{ stats()?.bans || 0 }}</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kicks</h3>
          <p class="mt-2 text-2xl font-bold text-orange-600">{{ stats()?.kicks || 0 }}</p>
        </app-card>
        <app-card padding="md">
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mutes</h3>
          <p class="mt-2 text-2xl font-bold text-slate-900">{{ stats()?.mutes || 0 }}</p>
        </app-card>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Suspicious Users -->
        <div class="lg:col-span-2">
          <app-card title="Suspicious Activity" subtitle="Users with high behavior risk scores.">
            <div class="mt-4 divide-y divide-slate-100">
              @for (user of stats()?.suspiciousUsers; track user.id) {
                <div class="flex items-center justify-between py-4">
                  <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                      {{ user.username.charAt(0) }}
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-slate-900">{{ user.username }}</p>
                      <p class="text-xs text-slate-500">{{ user.reason }}</p>
                    </div>
                  </div>
                  <div class="flex flex-col items-end">
                    <span
                      class="rounded-full px-2 py-1 text-xs font-bold"
                      [class.bg-red-50]="user.score >= 80"
                      [class.text-red-700]="user.score >= 80"
                      [class.bg-orange-50]="user.score < 80"
                      [class.text-orange-700]="user.score < 80"
                    >
                      Score: {{ user.score }}
                    </span>
                    <button class="mt-1 text-[10px] text-[#5865F2] hover:underline">View Evidence</button>
                  </div>
                </div>
              }
            </div>
          </app-card>
        </div>

        <!-- Placeholder for Trends Chart -->
        <div>
          <app-card title="7-Day Trend" subtitle="Moderation action frequency.">
            <div class="mt-8 flex h-48 items-end justify-between gap-2 px-2">
              @for (day of stats()?.trends; track day.date) {
                <div class="flex flex-1 flex-col items-center gap-2">
                  <div
                    class="w-full rounded-t-lg bg-[#5865F2]/20 transition-all hover:bg-[#5865F2]"
                    [style.height.%]="(day.count / 35) * 100"
                  ></div>
                  <span class="text-[8px] text-slate-400">{{ day.date | date:'EE' }}</span>
                </div>
              }
            </div>
          </app-card>
        </div>
      </div>
    </div>
  `,
})
export class ModerationComponent implements OnInit {
  private moderationService = inject(ModerationService);
  stats = this.moderationService.stats;

  ngOnInit(): void {
    this.moderationService.fetchStats();
  }
}
