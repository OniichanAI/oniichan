import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../chat.model';
import { OniMascotComponent } from '../../../../core/branding/oni-mascot.component';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, OniMascotComponent],
  styles: [
    `
      :host { display: block; }
      .typing-cursor {
        display: inline-block;
        width: 0.5ch;
        margin-left: 1px;
        background: currentColor;
        animation: blink 1s steps(2, start) infinite;
      }
      @keyframes blink {
        to { visibility: hidden; }
      }
    `,
  ],
  template: `
    <div class="flex w-full gap-3" [class.flex-row-reverse]="message.role === 'user'">
      @if (message.role === 'assistant') {
        <oni-mascot
          size="sm"
          [mood]="message.action ? 'serious' : 'happy'"
        />
      } @else {
        <span
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oni-ink-mute font-display text-xs font-bold text-white shadow-sm"
          aria-label="You"
        >
          U
        </span>
      }

      <div class="flex max-w-[80%] flex-col gap-2">
        <div
          class="whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm shadow-sm"
          [class.bg-oni-surface]="message.role === 'assistant'"
          [class.border]="message.role === 'assistant'"
          [class.border-oni-border]="message.role === 'assistant'"
          [class.text-oni-ink]="message.role === 'assistant'"
          [class.bg-oni-primary]="message.role === 'user'"
          [class.text-white]="message.role === 'user'"
        >
          {{ message.content }}
          @if (streaming) {
            <span class="typing-cursor" aria-hidden="true">&nbsp;</span>
          }

          @if (message.role === 'assistant' && message.intent_kind) {
            <div class="mt-2 flex items-center gap-2 border-t border-oni-border pt-2 text-[10px] font-medium text-oni-ink-mute">
              <span class="font-mono uppercase tracking-wider">{{ message.intent_kind }}</span>
              @if (message.confidence != null) {
                <span class="h-1 w-1 rounded-full bg-oni-border-strong"></span>
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

        <span
          class="px-1 text-[10px] text-oni-ink-mute"
          [class.text-right]="message.role === 'user'"
        >
          {{ message.created_at | date:'shortTime' }}
        </span>
      </div>
    </div>
  `,
})
export class MessageBubbleComponent {
  @Input({ required: true }) message!: ChatMessage;
  /** True while this specific bubble is being streamed into. */
  @Input() streaming = false;
}
