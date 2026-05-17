import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from './chat.service';
import { MessageBubbleComponent } from './components/message-bubble/message-bubble.component';
import { ActionCardComponent } from './components/action-card/action-card.component';
import { CardComponent } from '../../shared/ui/card/card.component';

@Component({
  selector: 'app-chatops',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageBubbleComponent, ActionCardComponent, CardComponent],
  template: `
    <div class="flex h-full flex-col gap-6">
      <app-card title="ChatOps" subtitle="Interact with your Discord server using natural language.">
      </app-card>

      <div class="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <!-- Messages Area -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          @if (chatService.messages().length === 0) {
            <div class="flex h-full flex-col items-center justify-center text-center">
              <div class="h-12 w-12 rounded-full bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] mb-4">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 class="text-lg font-bold text-slate-900">Start a Conversation</h3>
              <p class="mt-1 text-sm text-slate-500 max-w-xs mx-auto">
                Ask me to moderate users, manage channels, or give you server insights.
              </p>
            </div>
          }

          @for (msg of chatService.messages(); track msg.id) {
            <app-message-bubble [message]="msg">
              <div actions class="space-y-3">
                @for (action of msg.actions; track $index) {
                  <app-action-card
                    [action]="action"
                    [status]="msg.status"
                    (confirm)="onConfirmAction(msg.id, $index)"
                  >
                  </app-action-card>
                }
              </div>
            </app-message-bubble>
          }
        </div>

        <!-- Input Area -->
        <div class="border-t border-slate-100 p-4 bg-slate-50/50">
          <form (submit)="onSend($event)" class="relative">
            <input
              type="text"
              [(ngModel)]="userInput"
              name="prompt"
              placeholder="Type a command or ask a question..."
              class="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 pr-12 text-sm shadow-sm transition-all focus:border-[#5865F2] focus:outline-none focus:ring-4 focus:ring-[#5865F2]/5"
            />
            <button
              type="submit"
              [disabled]="!userInput.trim()"
              class="absolute right-2 top-2 h-10 w-10 rounded-xl bg-[#5865F2] text-white transition-all hover:bg-[#4752C4] disabled:opacity-50 disabled:bg-slate-300 flex items-center justify-center"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
          <p class="mt-2 text-center text-[10px] text-slate-400">
            AI can make mistakes. Verify important actions before confirming.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class ChatopsComponent {
  chatService = inject(ChatService);
  userInput = '';

  onSend(event: Event): void {
    event.preventDefault();
    if (!this.userInput.trim()) return;

    this.chatService.sendMessage(this.userInput);
    this.userInput = '';
  }

  onConfirmAction(messageId: string, actionIndex: number): void {
    this.chatService.confirmAction(messageId, actionIndex);
  }
}
