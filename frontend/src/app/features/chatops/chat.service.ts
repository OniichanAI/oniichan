import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  ActionResolutionResponse,
  ChatHistory,
  ChatMessage,
  ChatSendResponse,
  PendingAction,
} from './chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  private messagesSignal = signal<ChatMessage[]>([]);
  private busySignal = signal(false);

  messages = this.messagesSignal.asReadonly();
  busy = this.busySignal.asReadonly();

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

  private applyResolution(updated: PendingAction): void {
    this.messagesSignal.update((current) =>
      current.map((m) => (m.action?.id === updated.id ? { ...m, action: updated } : m)),
    );
  }
}
