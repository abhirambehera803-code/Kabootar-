export interface User {
  id: string;
  email: string;
  phone?: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  role: 'user' | 'admin';
  status: 'online' | 'offline';
  lastSeen: string;
  createdAt: string;
  notificationSettings: {
    enabled: boolean;
    sound: boolean;
    showPreview: boolean;
  };
  privacySettings: {
    phoneVisibility: 'everyone' | 'contacts' | 'nobody';
    lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
  };
}

export interface ConversationMember {
  id: string;
  userId: string;
  role: 'creator' | 'admin' | 'member';
  joinedAt: string;
  user?: User | null;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationSeconds?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatar: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file';
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
    type: string;
  } | null;
  forwardedFrom?: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  attachment?: MessageAttachment;
  reactions: { [emoji: string]: string[] };
}

export interface ConversationSummary {
  id: string;
  type: 'direct' | 'group';
  title: string;
  avatarUrl: string;
  description?: string;
  recipient?: User | null;
  memberCount: number;
  role: 'creator' | 'admin' | 'member';
  unreadCount: number;
  isMuted: boolean;
  lastMessage?: Message | null;
  lastActivityAt: string;
}

export interface ConversationDetail {
  id: string;
  type: 'direct' | 'group';
  title: string;
  avatarUrl: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  role: 'creator' | 'admin' | 'member';
  isMuted: boolean;
  recipient?: User | null;
  members: ConversationMember[];
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  deviceInfo: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'user' | 'message';
  targetId: string;
  targetPreview: string;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}
