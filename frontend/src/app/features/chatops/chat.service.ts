import { Injectable, NgZone, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { TenantService } from '../../core/stores/tenant.service';
import {
  ActionResolutionResponse,
  ChatHealth,
  ChatHistory,
  ChatMessage,
  ChatSendResponse,
  PendingAction,
} from './chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private tenantService = inject(TenantService);
  // The fetch + ReadableStream path runs outside NgZone, so signal mutations
  // don't tick change detection on their own. We wrap each per-delta update
  // in zone.run() so the typing cursor moves token-by-token instead of all
  // at once at the end.
  private zone = inject(NgZone);

  // ---------- Token-smoothing typewriter ----------
  // Why: Groq/gpt-oss-20b runs at ~1000 tok/sec, so a 40-token reply
  // arrives in ~40ms — faster than a single browser frame. Without
  // smoothing, "streaming" looks like an instant paste. We buffer the
  // ground-truth text per message and drain it at a natural typing
  // speed via requestAnimationFrame. Slow models (HF, big self-hosted)
  // never queue, so they play out at their own pace.
  //
  // Drain rate auto-scales up if the buffer grows large — we never lag
  // the model by more than a few hundred ms even on bursts.
  private pendingByMsgId = new Map<string, string>();
  // Once the canonical (finalised) ChatMessageResponse arrives for an id,
  // park it here. We swap it in only after the buffer for that id has
  // fully drained so the action card doesn't appear before the text it
  // accompanies is finished typing.
  private pendingFinalByMsgId = new Map<string, ChatMessage>();
  private rafScheduled = false;

  private messagesSignal = signal<ChatMessage[]>([]);
  private busySignal = signal(false);
  private healthSignal = signal<ChatHealth | null>(null);
  // Id of the assistant message currently being streamed into, if any.
  // The UI uses this to render a typing cursor on the right bubble.
  private streamingIdSignal = signal<string | null>(null);

  messages = this.messagesSignal.asReadonly();
  busy = this.busySignal.asReadonly();
  health = this.healthSignal.asReadonly();
  streamingId = this.streamingIdSignal.asReadonly();

  loadHealth(): Observable<ChatHealth> {
    return this.http
      .get<ChatHealth>('/api/v1/chat/health')
      .pipe(tap((h) => this.healthSignal.set(h)));
  }

  load(): Observable<ChatHistory> {
    this.busySignal.set(true);
    return this.http.get<ChatHistory>('/api/v1/chat/messages').pipe(
      tap({
        next: (history) => {
          this.messagesSignal.set(history.messages);
          this.busySignal.set(false);
        },
        error: () => this.busySignal.set(false),
      }),
    );
  }

  send(text: string): Observable<ChatSendResponse> {
    this.busySignal.set(true);
    return this.http.post<ChatSendResponse>('/api/v1/chat/messages', { text }).pipe(
      tap({
        next: (response) => {
          this.messagesSignal.update((current) => [
            ...current,
            response.user_message,
            response.assistant_message,
          ]);
          this.busySignal.set(false);
        },
        error: () => this.busySignal.set(false),
      }),
    );
  }

  /**
   * Streaming variant. Returns a promise that resolves when the assistant
   * message is finalized. The signals update in real time so templates
   * showing `messages()` will tick token-by-token.
   *
   * Wire format mirrors what the backend emits:
   *   start    → push user_message + an empty placeholder assistant bubble
   *   delta    → append text to the placeholder
   *   complete → swap placeholder for the canonical assistant_message
   *   error    → mark busy=false, surface via toast (HTTP interceptor)
   */
  async sendStream(text: string): Promise<void> {
    if (this.busySignal()) return;
    this.busySignal.set(true);

    // Streaming responses don't go through HttpClient (we'd lose the chunked
    // body), so build the request manually. We still need the tenant header.
    const tenantId = this.tenantService.getTenantId();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;

    let response: Response;
    try {
      response = await fetch('/api/v1/chat/messages/stream', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      this.busySignal.set(false);
      this.streamingIdSignal.set(null);
      throw err;
    }

    if (!response.ok || !response.body) {
      this.busySignal.set(false);
      this.streamingIdSignal.set(null);
      throw new Error(`Stream failed (HTTP ${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let placeholderId: string | null = null;

    const flushFrames = () => {
      // SSE frames are separated by a blank line ("\n\n").
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        // Run each frame's signal mutation inside NgZone so CD actually ticks.
        this.zone.run(() => this.handleFrame(frame, (id) => (placeholderId = id)));
        boundary = buffer.indexOf('\n\n');
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        flushFrames();
      }
      // Flush any trailing partial frame (rare with well-behaved servers).
      buffer += decoder.decode();
      flushFrames();
    } finally {
      this.busySignal.set(false);
      this.streamingIdSignal.set(null);
      // Defensive: if the stream ended without a `complete` event, leave
      // whatever we accumulated visible so the user isn't staring at a void.
      // The placeholderId is set on `start` and cleared on `complete`.
    }
  }

  /**
   * Process a single decoded SSE frame. Frame format (per the spec):
   *   event: <name>
   *   data: <json>
   */
  private handleFrame(frame: string, onStart: (id: string) => void): void {
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;

    let payload: unknown;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }

    if (eventName === 'start') {
      const userMsg = (payload as { user_message: ChatMessage }).user_message;
      // Synthesize a placeholder assistant bubble that we'll mutate in place.
      const placeholder: ChatMessage = {
        id: `__streaming__${userMsg.id}`,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        action: null,
        intent_kind: null,
        confidence: null,
      };
      onStart(placeholder.id);
      this.streamingIdSignal.set(placeholder.id);
      this.messagesSignal.update((cur) => [...cur, userMsg, placeholder]);
      return;
    }

    if (eventName === 'delta') {
      const text = (payload as { text: string }).text || '';
      const streamingId = this.streamingIdSignal();
      if (!streamingId || !text) return;
      // Append to the per-bubble buffer; the drain loop will render it.
      const existing = this.pendingByMsgId.get(streamingId) ?? '';
      this.pendingByMsgId.set(streamingId, existing + text);
      this.scheduleDrain();
      return;
    }

    if (eventName === 'complete') {
      const finalMsg = (payload as { assistant_message: ChatMessage }).assistant_message;
      const streamingId = this.streamingIdSignal();
      if (!streamingId) {
        // Defensive: no active bubble — just append the canonical message.
        this.messagesSignal.update((cur) => [...cur, finalMsg]);
        return;
      }
      // Park the canonical message. It's swapped in once the typewriter
      // buffer for this id has fully drained (handled in drainTick).
      this.pendingFinalByMsgId.set(streamingId, finalMsg);
      this.scheduleDrain();
      return;
    }

    if (eventName === 'error') {
      // Drop the placeholder, surface nothing more — the busy flag clears
      // in the finally block and the global toast interceptor only fires
      // for non-2xx, so we surface manually here if the server emitted one.
      const detail = (payload as { detail?: string }).detail || 'Stream failed.';
      const streamingId = this.streamingIdSignal();
      if (streamingId) {
        this.messagesSignal.update((cur) =>
          cur.map((m) =>
            m.id === streamingId
              ? { ...m, content: m.content || `(stream interrupted: ${detail})` }
              : m,
          ),
        );
      }
      this.streamingIdSignal.set(null);
    }
  }

  reset(): Observable<void> {
    return this.http.post<void>('/api/v1/chat/messages/reset', {}).pipe(
      tap(() => this.messagesSignal.set([])),
    );
  }

  confirmAction(actionId: string): Observable<ActionResolutionResponse> {
    return this.http
      .post<ActionResolutionResponse>(`/api/v1/chat/actions/${actionId}/confirm`, {})
      .pipe(tap((res) => this.applyResolution(res.action)));
  }

  cancelAction(actionId: string): Observable<ActionResolutionResponse> {
    return this.http
      .post<ActionResolutionResponse>(`/api/v1/chat/actions/${actionId}/cancel`, {})
      .pipe(tap((res) => this.applyResolution(res.action)));
  }

  /**
   * Schedule the drain loop iff one isn't already running.
   * Uses requestAnimationFrame so it ticks per browser paint (60Hz typical).
   */
  private scheduleDrain(): void {
    if (this.rafScheduled) return;
    this.rafScheduled = true;
    // Outside NgZone so the rAF callback itself doesn't drag the zone with it;
    // we re-enter the zone inside drainTick only when we mutate the signal.
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => this.drainTick());
    });
  }

  /**
   * One drain tick:
   *   - For each id with pending text, advance the rendered content by N chars.
   *   - Drain rate auto-scales with buffer size (catches up on bursts but
   *     stays at typing speed on slow streams).
   *   - If a "complete" message arrived for an id AND its buffer is empty,
   *     swap the canonical message in and finish that stream.
   */
  private drainTick(): void {
    this.rafScheduled = false;
    let anyPending = false;

    for (const [id, pending] of this.pendingByMsgId) {
      if (pending.length === 0) {
        // Buffer empty — see if we have a canonical message waiting.
        const finalMsg = this.pendingFinalByMsgId.get(id);
        if (finalMsg) {
          this.zone.run(() => {
            this.messagesSignal.update((cur) =>
              cur.map((m) => (m.id === id ? finalMsg : m)),
            );
            if (this.streamingIdSignal() === id) {
              this.streamingIdSignal.set(null);
            }
          });
          this.pendingFinalByMsgId.delete(id);
          this.pendingByMsgId.delete(id);
        }
        continue;
      }

      // Drain rate: aim for ~120 chars/sec at small buffers (~2 chars/frame
      // at 60Hz), accelerate when the model is faster than that. Never let
      // the buffer get more than ~250ms of typing behind.
      const baseChars = 2;
      const catchupChars = Math.floor(pending.length / 30);
      const charsThisTick = Math.max(baseChars, Math.min(pending.length, baseChars + catchupChars));
      const chunk = pending.slice(0, charsThisTick);
      const remaining = pending.slice(charsThisTick);
      this.pendingByMsgId.set(id, remaining);

      this.zone.run(() => {
        this.messagesSignal.update((cur) =>
          cur.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m)),
        );
      });
      anyPending = true;
    }

    // Keep ticking if anything is still in flight (text pending OR a final
    // message waiting on its buffer to drain).
    if (anyPending || this.pendingFinalByMsgId.size > 0) {
      this.scheduleDrain();
    }
  }

  private applyResolution(updated: PendingAction): void {
    this.messagesSignal.update((current) =>
      current.map((m) => (m.action?.id === updated.id ? { ...m, action: updated } : m)),
    );
  }
}
