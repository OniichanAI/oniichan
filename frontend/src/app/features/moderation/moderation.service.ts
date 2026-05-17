import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GuildSnapshot {
  discord_guild_id: string;
  name: string;
  member_count: number | null;
  channel_count: number | null;
  text_channel_count: number | null;
  voice_channel_count: number | null;
}

export interface ModerationState {
  guild: GuildSnapshot | null;
  recent_actions: number;
}

@Injectable({ providedIn: 'root' })
export class ModerationService {
  private http = inject(HttpClient);

  getState(): Observable<ModerationState> {
    return this.http.get<ModerationState>('/api/v1/moderation/state');
  }
}
