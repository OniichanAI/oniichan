import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../chat.model';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex w-full gap-3" [class.flex-row-reverse]="message.role === 'user'">
      <!-- Avatar -->
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
        [class.bg-[#5865F2]]="message.role === 'assistant'"
        [class.bg-slate-400]="message.role === 'user'"
      >
        {{ message.role === 'assistant' ? 'AI' : 'U' }}
      </div>

      <!-- Content -->
      <div class="flex max-w-[80%] flex-col gap-2">
        <div
          class="rounded-2xl px-4 py-2 text-sm shadow-sm"
          [class.bg-white]="message.role === 'assistant'"
          [class.border]="message.role === 'assistant'"
          [class.border-slate-100]="message.role === 'assistant'"
          [class.text-slate-800]="message.role === 'assistant'"
          [class.bg-[#5865F2]]="message.role === 'user'"
          [class.text-white]="message.role === 'user'"
        >
          {{ message.content }}
          
          <!-- Confidence/Intent indicator for AI -->
          <div *ngIf="message.role === 'assistant' && message.intent" class="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[10px] font-medium text-slate-400">
            <span class="uppercase">Intent: {{ message.intent }}</span>
            <span class="h-1 w-1 rounded-full bg-slate-200"></span>
            <span>Confidence: {{ (message.confidence || 0) * 100 }}%</span>
          </div>
        </div>

        <!-- Render Actions -->
        <div *ngIf="message.actions && message.actions.length > 0" class="flex flex-col gap-3 mt-1">
          <ng-content select="[actions]"></ng-content>
        </div>

        <span class="text-[10px] text-slate-400 px-1" [class.text-right]="message.role === 'user'">
          {{ message.timestamp | date:'shortTime' }}
        </span>
      </div>
    </div>
  `,
})
export class MessageBubbleComponent {
  @Input({ required: true }) message!: ChatMessage;
}
