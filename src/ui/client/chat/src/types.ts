// Shared types used across the chat UI client.

export type ChannelType =
  | 'web'
  | 'resend'
  | 'discord'
  | 'telegram'
  | 'whatsapp'
  | 'imessage'
  | 'signal'
  | 'slack'
  | 'matrix'
  | 'gchat'
  | 'cli'
  | string;

export interface ChannelMetaEntry {
  label: string;
  icon: string;
}

export interface Group {
  id: string;
  name: string;
  isAdmin?: boolean;
  lastActivityAt?: string;
}

export interface Thread {
  threadId: string;
  sessionId?: string | null;
  channelType?: ChannelType;
  messagingGroupId?: string | null;
  sessionMode?: string;
  title: string;
  lastActivityAt: string;
  messageCount?: number;
  kind?: 'dm' | 'thread';
  counterparty?: string;
  canSend?: boolean;
}

export interface ThreadCtx {
  channelType: ChannelType;
  messagingGroupId: string | null;
  canSend: boolean;
}

export type Direction = 'in' | 'out' | 'internal';

export interface ChatMessageFile {
  filename: string;
  size?: number;
  path?: string | null;
}

export interface ChatMessage {
  direction: Direction;
  text: string;
  files: ChatMessageFile[] | null;
  ts: string;
}

export interface TreeEntry {
  path: string;
  name: string;
  type: 'file' | 'dir';
  size?: number;
  mtime?: string;
  tier?: number;
}

export type PreviewKind = 'image' | 'audio' | 'video' | 'pdf' | 'markdown' | 'text' | 'binary' | 'error';

export interface PreviewBlock {
  kind: PreviewKind;
  url?: string;
  html?: string;
  text?: string;
  mime?: string;
  ext?: string;
  name?: string;
  size?: number | null;
  mtime?: string | null;
  path?: string;
  tags?: Record<string, unknown> | null;
  lyrics?: string | null;
}

export interface UploadItem {
  file: File;
  name: string;
  size: number;
  status: 'uploading' | 'ok' | 'error' | 'conflict';
  pct?: number;
  statusText?: string;
  path?: string | null;
}

export interface Identity {
  channel: string;
  handle: string;
  primary?: boolean;
}

export interface ShareModalRequest {
  groupId: string;
  entry: { path: string; name: string; type?: string };
}

export interface ToastMessage {
  id: number;
  text: string;
  kind?: 'ok' | 'err';
}

export interface PendingFile {
  name: string;
  size: number;
  // Backed by a real File when picked from the composer; the chat send
  // uses it via FormData.
  // eslint-disable-next-line @typescript-eslint/ban-types
  file?: File;
}

export interface RouterApi {
  selectGroup: (gid: string) => Promise<void>;
  loadThreads: (gid: string) => Promise<void>;
  openChat: (gid: string, tid: string | null, opts: ThreadCtx | null) => Promise<void>;
  clearChat: () => void;
  loadTree: (p: string) => Promise<void>;
  selectFile: (entry: Pick<TreeEntry, 'path' | 'name'> & Partial<TreeEntry>) => Promise<void>;
  notFound: (msg: string) => void;
}

// Value sent by the chat WS in `kind: 'inbound'|'outbound'|'typing'|'ready'`.
export interface WsPayload {
  kind: 'ready' | 'typing' | 'inbound' | 'outbound';
  on?: boolean;
  hint?: string;
  text?: string;
  content?: string | { text?: string; markdown?: string };
  files?: ChatMessageFile[] | null;
  timestamp?: string;
  id?: string;
  messageKind?: 'internal' | 'final' | string;
}
