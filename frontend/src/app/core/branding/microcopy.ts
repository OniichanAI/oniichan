/**
 * Centralized Oniichan voice — every user-facing string with personality lives
 * here. Components import named constants instead of inlining copy, so we can
 * tune the tone (dial up/down the kawaii, neutralize for an enterprise SKU
 * later, A/B test, translate) without touching template files.
 *
 * House rules:
 *  - Visual chrome stays calm; voice is loud.
 *  - Never apologize. Onii-chan is *busy*.
 *  - Audit/receipt copy can lean into the Navy Seal energy — that's where a
 *    moderator is acting on a rulebreaker. Chrome stays cuter.
 *  - Keep each string under ~120 chars unless it's a multi-line empty state.
 */
export const ONI = {
  brand: {
    name: 'Oniichan',
    tagline: 'Discord Ops for the ones in charge.',
  },

  auth: {
    loginHeading: 'Onii-chan is waiting',
    loginSub: "Sign in with Discord and let onii-chan handle the troublemakers.",
    loginCta: 'Login with Discord-senpai',
    callbackWorking: 'Onii-chan is checking your papers...',
    callbackInstalling: 'Tucking your server into onii-chan’s watchlist...',
    callbackError: 'Mou~ that did not work. Try again, onii-chan needs you back.',
  },

  onboarding: {
    title: 'Pick a server, onii-chan~',
    sub: 'Choose a Discord server for onii-chan to look after.',
    addServer: 'Add a new server',
    addServerSub: 'Onii-chan will join and be on his best behavior. Promise.',
    installing: 'Opening Discord...',
    emptyHint: 'No servers yet — click "Add a new server" so onii-chan has somewhere to patrol.',
  },

  dashboard: {
    currentServerLabel: 'Now watching',
    primaryCta: 'Open ChatOps',
    statAuditLabel: 'Things onii-chan logged',
    statAuditHint: 'All actions, AI and human',
    statServersLabel: 'Servers onii-chan watches',
    statServersHint: 'Across your account',
    statAutonomyLabelOn: 'Autonomy ON',
    statAutonomyLabelOff: 'Autonomy off',
    statAutonomyHint: 'Manual confirmation required',
    recentActivityTitle: 'Latest mischief',
    recentActivitySub: 'The five most recent things onii-chan noticed.',
    recentEmpty: 'Quiet so far. Suspiciously quiet.',
    seeAll: 'See the full ledger →',
  },

  moderation: {
    title: 'Server snapshot',
    sub: "Live numbers from Discord plus everything onii-chan has filed away.",
    members: 'Members under watch',
    channels: 'Channels',
    channelsHint: 'Text + voice',
    text: 'Text',
    textHint: 'Incl. announcement & forum',
    voice: 'Voice',
    voiceHint: 'Incl. stage',
    categories: 'Categories',
    categoriesHint: 'Just organisational',
    auditCardTitle: "What's been recorded",
    auditCardSub: 'Total entries onii-chan has kept on this server.',
    auditCardCta: 'Open the audit log →',
    refresh: 'Refresh',
    refreshing: 'Refreshing...',
    noBotTokenHint:
      "Member and channel counts come from Discord using onii-chan's bot token. " +
      "If they're blank, set DISCORD_BOT_TOKEN in backend/.env and make sure the bot is still in the server.",
  },

  audit: {
    title: 'Audit log',
    sub: 'Every move on this server, AI or human. Onii-chan forgets nothing.',
    filterPlaceholder: 'Filter by event type (e.g. tenant.provisioned)',
    refresh: 'Refresh',
    refreshing: 'Loading...',
    loading: 'Loading events...',
    empty: 'No events yet. Install the bot on a server so onii-chan has work to do.',
    headers: {
      event: 'Event',
      risk: 'Risk',
      summary: 'Summary',
      time: 'Time',
    },
  },

  chatops: {
    title: 'ChatOps',
    sub: 'Tell onii-chan what to do. He parses it locally for now — LLM streaming comes next.',
    reset: 'New session',
    placeholder: "What's the move, onii-chan?",
    busy: 'Onii-chan is thinking...',
    emptyTitle: 'Onii-chan is listening',
    emptyBody:
      'Try a slow-mode tweak, an announcement, or just ask for a server summary. ' +
      "Anything risky needs your nod before he actually swings.",
    examples: [
      'enable slowmode 30s',
      'timeout @user for 10m',
      'give @user the moderator role',
      'kick @user',
      'ban @user',
      'announce server maintenance at 8pm',
      'summary',
    ],
    footer:
      "Dry-run by default — flip on execution in Settings before onii-chan goes live.",
    confirm: 'Confirm',
    cancel: 'Cancel',
    statusExecuted: 'Done',
    statusCancelled: 'Cancelled',
    statusExpired: 'Expired',
  },

  settings: {
    title: 'Autonomy & execution',
    sub: "Controls what onii-chan is actually allowed to do against Discord.",
    killTitleOn: 'Stand down — onii-chan is in time-out',
    killTitleOff: 'Onii-chan is on standby',
    killSubOn: 'Kill switch is active. Every confirm falls back to dry-run, no exceptions.',
    killSubOff:
      'Hit this if anything looks off. Every confirm immediately drops to dry-run regardless of other settings.',
    killBtnOn: 'STAND DOWN',
    killBtnOff: 'EMERGENCY STOP',
    executionTitle: 'Execution',
    executionSub: 'Master switch for live Discord side effects.',
    executionToggleLabel: 'Allow onii-chan to swing for real',
    executionToggleSub: 'When off, confirmed actions are recorded only — onii-chan files but never moves.',
    autonomyToggleLabel: 'Let onii-chan run autonomously',
    autonomyToggleSub:
      'Reserved. When on, allowed-risk actions run without human approval. Use sparingly, onii-chan likes his leash.',
    riskTitle: 'Risk cap',
    riskSub: 'Highest tier onii-chan is allowed to touch.',
    riskBlurb: {
      low: 'Read-only and reversible. Onii-chan can look but rarely move.',
      medium: 'Slow mode, announcements, role tweaks. Onii-chan can rearrange.',
      high: 'Bans, kicks, channel deletes. Onii-chan goes Navy Seal.',
    } as const,
    saved: 'Saved — onii-chan adjusted his collar.',
    effective: {
      kill: 'Kill switch active',
      dryRun: 'Dry-run only',
      live: (tier: string) => `Live up to ${tier}`,
    },
  },

  shell: {
    badgeKill: 'Kill switch',
    badgeLive: 'Live · don’t test onii-chan',
    badgeDryRun: 'Dry-run',
    switchServer: 'Switch server',
    logout: 'Sign out',
  },

  receipts: {
    dryRunReason: (reason: string) =>
      `Recorded only — ${reason}. Flip execution on if you want onii-chan to actually swing.`,
    liveOk: 'Mission complete. Onii-chan kept the receipt.',
    liveFailed: (note: string) =>
      `Nani?! Discord rejected that. ${note}`,
  },
} as const;

export type Microcopy = typeof ONI;
