export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: number;
  actions?: AIAction[];
  status?: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface AIAction {
  type: string;
  description: string;
  risk_tier: 'low' | 'medium' | 'high';
  requires_confirmation: boolean;
  parameters: any;
  outcome?: string;
}
