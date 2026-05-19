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
import { OniEmptyComponent } from '../../core/branding/oni-empty.component';
import { OniIconComponent } from '../../core/branding/oni-icon.component';
import { ONI } from '../../core/branding/microcopy';

@Component({
  selector: 'app-chatops',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MessageBubbleComponent,
    ActionCardComponent,
    CardComponent,
    OniEmptyComponent,
    OniIconComponent,
  ],
  template: `
    <div class="flex h-full flex-col gap-8">
      <app-card [title]="copy.chatops.title" [subtitle]="copy.chatops.sub">
        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            (click)="onReset()"
            class="shrink-0 whitespace-nowrap rounded-2xl border border-oni-border bg-oni-surface px-3 py-1.5 font-medium text-oni-ink-strong transition hover:border-oni-primary"
          >
            {{ copy.chatops.reset }}
          </button>

          @if (chatService.health(); as h) {
            @if (h.llm_enabled) {
              <span
                class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-oni-primary-soft px-2.5 py-1 text-[11px] font-semibold text-oni-primary-deep"
                title="Intent parsing uses an LLM"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-oni-primary"></span>
                <span class="max-w-[12rem] truncate sm:max-w-none">Powered by {{ h.model }}</span>
              </span>
            } @else {
              <span
                class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-oni-surface-mute px-2.5 py-1 text-[11px] font-medium text-oni-ink-mute"
                title="LLM_API_KEY not set in backend/.env — falling back to regex"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-oni-ink-mute"></span>
                Heuristic mode
              </span>
            }
          }
        </div>

        <!-- Example chips on their own row; scroll horizontally on narrow
             screens instead of wrapping into a tall stack. -->
        <div
          class="mt-3 -mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0"
        >
          <div class="flex w-max items-center gap-2 text-xs sm:w-auto sm:flex-wrap">
            <span class="shrink-0 whitespace-nowrap text-oni-ink-mute">Try:</span>
            @for (example of copy.chatops.examples; track example) {
              <code
                class="shrink-0 cursor-pointer whitespace-nowrap rounded-lg bg-oni-surface-mute px-2 py-1 font-mono text-[11px] text-oni-ink-strong transition hover:bg-oni-primary-soft hover:text-oni-primary-deep"
                (click)="useExample(example)"
                role="button"
                tabindex="0"
                [attr.aria-label]="'Use example: ' + example"
              >
                {{ example }}
              </code>
            }
          </div>
        </div>
      </app-card>

      <div
        class="flex flex-1 flex-col overflow-hidden rounded-3xl border border-oni-border bg-oni-surface"
        style="box-shadow: var(--shadow-oni-soft)"
      >
        <div #scroll class="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          @if (chatService.messages().length === 0 && !chatService.busy()) {
            <oni-empty
              size="lg"
              mood="happy"
              [title]="copy.chatops.emptyTitle"
              [message]="copy.chatops.emptyBody"
            />
          }

          @for (msg of chatService.messages(); track msg.id) {
            <app-message-bubble
              [message]="msg"
              [streaming]="chatService.streamingId() === msg.id"
            >
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

          @if (chatService.busy() && !chatService.streamingId() && chatService.messages().length > 0) {
            <div class="flex items-center gap-2 text-xs text-oni-ink-mute">
              <div class="h-3 w-3 animate-spin rounded-full border-2 border-solid border-oni-primary border-r-transparent"></div>
              {{ copy.chatops.busy }}
            </div>
          }
        </div>

        <div class="border-t border-oni-border bg-oni-surface-mute p-3 sm:p-4">
          <form (submit)="onSend($event)" class="relative">
            <input
              type="text"
              [(ngModel)]="userInput"
              name="prompt"
              [disabled]="chatService.busy()"
              [placeholder]="copy.chatops.placeholder"
              class="w-full rounded-2xl border border-oni-border bg-oni-surface px-5 py-4 pr-12 text-sm text-oni-ink shadow-sm transition-all placeholder:text-oni-ink-mute focus:border-oni-primary focus:outline-none focus:ring-4 focus:ring-oni-primary/15 disabled:opacity-60"
            />
            <button
              type="submit"
              [disabled]="!userInput.trim() || chatService.busy()"
              class="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-xl bg-oni-primary text-white transition-all hover:bg-oni-primary-deep disabled:bg-oni-border-strong disabled:opacity-50"
              aria-label="Send"
            >
              <oni-icon name="send" [size]="18" />
            </button>
          </form>
          <p class="mt-2 text-center text-[10px] text-oni-ink-mute">{{ copy.chatops.footer }}</p>
        </div>
      </div>
    </div>
  `,
})
export class ChatopsComponent implements OnInit, AfterViewChecked {
  chatService = inject(ChatService);
  userInput = '';
  actingOn = signal<string | null>(null);
  readonly copy = ONI;

  @ViewChild('scroll') private scrollContainer?: ElementRef<HTMLElement>;
  private lastScrollLen = 0;

  ngOnInit(): void {
    this.chatService.load().subscribe();
    this.chatService.loadHealth().subscribe();
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

  /** Click handler for an example chip — drops the text into the input
   *  ready to send, lets the user verify/edit before firing. */
  useExample(text: string): void {
    this.userInput = text;
  }

  onSend(event: Event): void {
    event.preventDefault();
    const text = this.userInput.trim();
    if (!text || this.chatService.busy()) return;
    this.userInput = '';
    // Fire-and-forget — the chat service updates signals as tokens arrive,
    // and the template re-renders. Errors surface via the global toast.
    this.chatService.sendStream(text).catch(() => {
      // Already surfaced server-side; swallow here so a network blip
      // doesn't bubble an UnhandledPromiseRejection.
    });
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
