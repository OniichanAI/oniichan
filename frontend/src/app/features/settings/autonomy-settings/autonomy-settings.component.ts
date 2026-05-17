import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

@Component({
  selector: 'app-autonomy-settings',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  template: `
    <div class="space-y-6">
      <app-card title="Autonomy Settings" subtitle="Configure AI automation boundaries and safety limits.">
        <div class="mt-4 flex items-center justify-between rounded-2xl bg-red-50 p-4 border border-red-100">
          <div>
            <h4 class="text-sm font-bold text-red-900">Global Kill Switch</h4>
            <p class="text-xs text-red-700">Immediately disable all autonomous AI actions across the server.</p>
          </div>
          <app-button variant="danger" size="sm">DEACTIVATE ALL</app-button>
        </div>
      </app-card>

      <div class="grid gap-6 md:grid-cols-2">
        <app-card title="Risk Thresholds" subtitle="Define what actions require human approval.">
          <div class="mt-4 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-slate-900">Low Risk Actions</p>
                <p class="text-xs text-slate-500">Analytics, non-destructive lookups.</p>
              </div>
              <div class="h-6 w-11 rounded-full bg-green-500 relative">
                 <div class="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"></div>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-slate-900">Medium Risk Actions</p>
                <p class="text-xs text-slate-500">Role assignment, channel permission edits.</p>
              </div>
              <div class="h-6 w-11 rounded-full bg-slate-200 relative">
                 <div class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"></div>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-slate-900">High Risk Actions</p>
                <p class="text-xs text-slate-500">Bans, kicks, channel deletion.</p>
              </div>
              <div class="h-6 w-11 rounded-full bg-slate-200 relative opacity-50">
                 <div class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"></div>
              </div>
            </div>
          </div>
        </app-card>

        <app-card title="Confidence Requirements" subtitle="Minimum AI confidence for autonomous execution.">
           <div class="mt-6">
             <div class="flex items-center justify-between mb-2">
               <span class="text-sm font-medium text-slate-900">Confidence Threshold</span>
               <span class="text-sm font-bold text-[#5865F2]">95%</span>
             </div>
             <input type="range" class="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#5865F2]" min="50" max="100" value="95" />
             <p class="mt-4 text-[10px] text-slate-400 italic">
               Requests below this threshold will always ask for clarification or confirmation.
             </p>
           </div>
        </app-card>
      </div>
    </div>
  `,
})
export class AutonomySettingsComponent {}
