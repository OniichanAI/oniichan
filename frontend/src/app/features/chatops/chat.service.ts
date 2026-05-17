import { Injectable, signal } from '@angular/core';
import { ChatMessage, AIAction } from './chat.model';
import { Observable, Subject, map, of, delay } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private messagesSignal = signal<ChatMessage[]>([]);
  messages = this.messagesSignal.asReadonly();

  sendMessage(content: string): void {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    this.messagesSignal.update((msgs) => [...msgs, userMessage]);

    // Mocking AI response for now
    this.mockAIResponse(content);
  }

  private mockAIResponse(userPrompt: string): void {
    const aiMessageId = crypto.randomUUID();
    
    // Initial "thinking" message
    const thinkingMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'pending',
    };

    this.messagesSignal.update((msgs) => [...msgs, thinkingMessage]);

    // Simulate streaming and intent detection
    setTimeout(() => {
      this.updateMessage(aiMessageId, {
        content: 'Analyzing your request...',
        intent: 'moderate_user',
        confidence: 0.98,
      });

      setTimeout(() => {
        const action: AIAction = {
          type: 'ban',
          description: 'Ban user @spammer for violation of rule #1',
          risk_tier: 'high',
          requires_confirmation: true,
          parameters: { userId: '123', reason: 'Spam' },
        };

        this.updateMessage(aiMessageId, {
          content: 'I have detected a violation. Should I proceed with the following action?',
          actions: [action],
          status: 'pending',
        });
      }, 1000);
    }, 800);
  }

  private updateMessage(id: string, updates: Partial<ChatMessage>): void {
    this.messagesSignal.update((msgs) =>
      msgs.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  }

  confirmAction(messageId: string, actionIndex: number): void {
    this.updateMessage(messageId, { status: 'executing' });
    
    // Simulate execution
    setTimeout(() => {
      this.messagesSignal.update((msgs) =>
        msgs.map((m) => {
          if (m.id === messageId && m.actions) {
            const updatedActions = [...m.actions];
            updatedActions[actionIndex] = {
              ...updatedActions[actionIndex],
              outcome: 'Successfully banned user.',
            };
            return { ...m, actions: updatedActions, status: 'completed' };
          }
          return m;
        })
      );
    }, 1500);
  }
}
