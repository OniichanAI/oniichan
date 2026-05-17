import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
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
      <app-card title="ChatOps" subtitle="Heuristic v0 — recognized intents are parsed locally; LLM streaming comes next.">
        <div class="mt-3 flex gap-2 text-xs">
          <button
            (click)="onReset()"
            class="rounded-xl border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300"
          >
            Reset session
          </button>
          <span class="self-center text-slate-400">
            Try: <code class="rounded bg-slate-100 px-1 py-0.5">enable slowmode 30s</code>,
            <code class="rounded bg-slate-100 px-1 py-0.5">announce ...</code>,
            <code class="rounded bg-slate-100 px-1 py-0.5">summary</code>
          </span>
        </div>
      </app-card>

      <div class="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div #scroll class="flex-1 space-y-6 overflow-y-auto p-6">
          @if (chatService.messages().length === 0 && !chatService.busy()) {
            <div class="flex h-full flex-col items-center justify-center text-center">
              <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#5865F2]/10 text-[#5865F2]">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 class="text-lg font-bold text-slate-900">Start a conversation</h3>
              <p class="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                Ask me to moderate users, manage channels, or give you server insights.
              </p>
            </div>
          }

          @for (msg of chatService.messages(); track msg.id) {
            <app-message-bubble [message]="msg">
              @if (msg.action) {
                <div actions>
                  <app-action-card
                    [action]="msg.action"
                    [busy]="actingOn() === msg.action.id"
                    (confirm)="onConfirm(msg.action!.id)"
                    (cancel)="onCancel(msg.action!.id)"
                  />
                </div>
              }
            </app-message-bubble>
          }

          @if (chatService.busy() && chatService.messages().length > 0) {
            <div class="flex items-center gap-2 text-xs text-slate-400">
              <div class="h-3 w-3 animate-spin rounded-full border-2 border-solid border-[#5865F2] border-r-transparent"></div>
              Thinking...
            </div>
          }
        </div>

        <div class="border-t border-slate-100 bg-slate-50/50 p-4">
          <form (submit)="onSend($event)" class="relative">
            <input
              type="text"
              [(ngModel)]="userInput"
              name="prompt"
              [disabled]="chatService.busy()"
              placeholder="Type a command or ask a question..."
              class="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 pr-12 text-sm shadow-sm transition-all focus:border-[#5865F2] focus:outline-none focus:ring-4 focus:ring-[#5865F2]/5 disabled:opacity-60"
            />
            <button
              type="submit"
              [disabled]="!userInput.trim() || chatService.busy()"
              class="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#5865F2] text-white transition-all hover:bg-[#4752C4] disabled:bg-slate-300 disabled:opacity-50"
              aria-label="Send"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
          <p class="mt-2 text-center text-[10px] text-slate-400">
            v0 runs in dry-run mode — confirmed actions are recorded in the audit log but not yet sent to Discord.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class ChatopsComponent implements OnInit, AfterViewChecked {
  chatService = inject(ChatService);
  userInput = '';
  actingOn = signal<string | null>(null);

  @ViewChild('scroll') private scrollContainer?: ElementRef<HTMLElement>;
  private lastScrollLen = 0;

  ngOnInit(): void {
    this.chatService.load().subscribe();
  }

  ngAfterViewChecked(): void {
    const len = this.chatService.messages().length;
    if (len !== this.lastScrollLen) {
      this.lastScrollLen = len;
      queueMicrotask(() => {
        const el = this.scrollContainer?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }

  onSend(event: Event): void {
    event.preventDefault();
    const text = this.userInput.trim();
    if (!text || this.chatService.busy()) return;
    this.userInput = '';
    this.chatService.send(text).subscribe();
  }

  onReset(): void {
    this.chatService.reset().subscribe();
  }

  onConfirm(actionId: string): void {
    this.actingOn.set(actionId);
    this.chatService.confirmAction(actionId).subscribe({
      next: () => this.actingOn.set(null),
      error: () => this.actingOn.set(null),
    });
  }

  onCancel(actionId: string): void {
    this.actingOn.set(actionId);
    this.chatService.cancelAction(actionId).subscribe({
      next: () => this.actingOn.set(null),
      error: () => this.actingOn.set(null),
    });
  }
}
