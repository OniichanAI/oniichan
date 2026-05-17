import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../chat.model';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex w-full gap-3" [class.flex-row-reverse]="message.role === 'user'">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
        [class.bg-\\[\\#5865F2\\]]="message.role === 'assistant'"
        [class.bg-slate-400]="message.role === 'user'"
      >
        {{ message.role === 'assistant' ? 'AI' : 'U' }}
      </div>

      <div class="flex max-w-[80%] flex-col gap-2">
        <div
          class="whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm shadow-sm"
          [class.bg-white]="message.role === 'assistant'"
          [class.border]="message.role === 'assistant'"
          [class.border-slate-100]="message.role === 'assistant'"
          [class.text-slate-800]="message.role === 'assistant'"
          [class.bg-\\[\\#5865F2\\]]="message.role === 'user'"
          [class.text-white]="message.role === 'user'"
        >
          {{ message.content }}

          @if (message.role === 'assistant' && message.intent_kind) {
            <div class="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[10px] font-medium text-slate-400">
              <span class="uppercase tracking-wider">Intent: {{ message.intent_kind }}</span>
              @if (message.confidence != null) {
                <span class="h-1 w-1 rounded-full bg-slate-200"></span>
                <span>Confidence: {{ (message.confidence * 100).toFixed(0) }}%</span>
              }
            </div>
          }
        </div>

        @if (message.action) {
          <div class="mt-1">
            <ng-content select="[actions]"></ng-content>
          </div>
        }

        <span class="px-1 text-[10px] text-slate-400" [class.text-right]="message.role === 'user'">
          {{ message.created_at | date:'shortTime' }}
        </span>
      </div>
    </div>
  `,
})
export class MessageBubbleComponent {
  @Input({ required: true }) message!: ChatMessage;
}
