export type ActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'expired';

export interface PendingAction {
  id: string;
  kind: string;
  summary: string;
  risk_tier: 'low' | 'medium' | 'high' | string;
  params: Record<string, unknown>;
  requires_confirmation: boolean;
  status: ActionStatus;
  receipt: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  action: PendingAction | null;
  intent_kind: string | null;
  confidence: number | null;
}

export interface ChatHistory {
  messages: ChatMessage[];
}

export interface ChatSendResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
}

export interface ActionResolutionResponse {
  action: PendingAction;
  receipt_text: string;
}

export interface ChatHealth {
  llm_enabled: boolean;
  provider: string;
  model: string | null;
}
