import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  passwordHash: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  role: 'user' | 'admin';
  isSuspended: boolean;
  status: 'online' | 'offline';
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
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

export interface Contact {
  id: string;
  userId: string;
  contactUserId: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatarUrl?: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageId?: string;
  lastActivityAt: string;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: 'creator' | 'admin' | 'member';
  joinedAt: string;
  lastReadMessageId?: string;
  unreadCount: number;
  isMuted: boolean;
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

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file';
  replyToId?: string;
  forwardedFrom?: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  attachment?: MessageAttachment;
  reactions?: { [emoji: string]: string[] }; // emoji -> array of userIds
}

export interface BlockedUser {
  id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'user' | 'message';
  targetId: string;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  deviceInfo: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  contacts: Contact[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  messages: Message[];
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  blockedUsers: BlockedUser[];
  reports: Report[];
  sessions: UserSession[];
}

class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.load();
    this.seedDefaults();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load database.json, initializing clean database', err);
    }
    return {
      users: [],
      contacts: [],
      conversations: [],
      conversationMembers: [],
      messages: [],
      attachments: [],
      reactions: [],
      blockedUsers: [],
      reports: [],
      sessions: []
    };
  }

  public save(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
        fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
        fs.renameSync(tempFile, DB_FILE);
      } catch (err) {
        console.error('Failed to atomic-write database:', err);
      }
    }, 50);
  }

  private seedDefaults(): void {
    if (this.data.users.length === 0) {
      const now = new Date().toISOString();
      const adminPassHash = bcrypt.hashSync('Admin123!', 10);
      const userPassHash = bcrypt.hashSync('Password123!', 10);

      const adminUser: User = {
        id: 'u_admin_seed',
        email: 'admin@aether.chat',
        phone: '+1 555-0100',
        passwordHash: adminPassHash,
        username: 'admin',
        displayName: 'Aether Admin',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio: 'System Administrator for Aether Messenger.',
        role: 'admin',
        isSuspended: false,
        status: 'online',
        lastSeen: now,
        createdAt: now,
        updatedAt: now,
        notificationSettings: { enabled: true, sound: true, showPreview: true },
        privacySettings: { phoneVisibility: 'everyone', lastSeenVisibility: 'everyone' }
      };

      const alexUser: User = {
        id: 'u_alex_seed',
        email: 'alex@aether.chat',
        phone: '+1 555-0142',
        passwordHash: userPassHash,
        username: 'alex_rivera',
        displayName: 'Alex Rivera',
        avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
        bio: 'Mobile dev & digital nomad. Building high-speed real-time software.',
        role: 'user',
        isSuspended: false,
        status: 'online',
        lastSeen: now,
        createdAt: now,
        updatedAt: now,
        notificationSettings: { enabled: true, sound: true, showPreview: true },
        privacySettings: { phoneVisibility: 'contacts', lastSeenVisibility: 'everyone' }
      };

      const sarahUser: User = {
        id: 'u_sarah_seed',
        email: 'sarah@aether.chat',
        phone: '+1 555-0199',
        passwordHash: userPassHash,
        username: 'sarah_connor',
        displayName: 'Sarah Connor',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        bio: 'Security researcher & UI designer. Always stay encrypted.',
        role: 'user',
        isSuspended: false,
        status: 'offline',
        lastSeen: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        createdAt: now,
        updatedAt: now,
        notificationSettings: { enabled: true, sound: true, showPreview: true },
        privacySettings: { phoneVisibility: 'everyone', lastSeenVisibility: 'contacts' }
      };

      this.data.users.push(adminUser, alexUser, sarahUser);

      // Seed Contacts
      this.data.contacts.push(
        { id: 'c_1', userId: alexUser.id, contactUserId: sarahUser.id, createdAt: now },
        { id: 'c_2', userId: sarahUser.id, contactUserId: alexUser.id, createdAt: now },
        { id: 'c_3', userId: alexUser.id, contactUserId: adminUser.id, createdAt: now }
      );

      // Seed Welcome Group Chat
      const groupConv: Conversation = {
        id: 'conv_welcome_group',
        type: 'group',
        name: 'Aether General Lounge',
        avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
        description: 'Welcome to Aether! Connect, share audio recordings, exchange files, and collaborate in real-time.',
        createdBy: adminUser.id,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now
      };

      this.data.conversations.push(groupConv);

      this.data.conversationMembers.push(
        { id: 'cm_1', conversationId: groupConv.id, userId: adminUser.id, role: 'creator', joinedAt: now, unreadCount: 0, isMuted: false },
        { id: 'cm_2', conversationId: groupConv.id, userId: alexUser.id, role: 'member', joinedAt: now, unreadCount: 0, isMuted: false },
        { id: 'cm_3', conversationId: groupConv.id, userId: sarahUser.id, role: 'member', joinedAt: now, unreadCount: 0, isMuted: false }
      );

      // Seed welcome message
      const welcomeMsg: Message = {
        id: 'm_welcome_1',
        conversationId: groupConv.id,
        senderId: adminUser.id,
        text: '👋 Welcome to Aether Messenger! You can send real-time text, voice recordings, photos, and files. Feel free to create new groups, add contacts, or message friends directly!',
        type: 'text',
        isEdited: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        reactions: { '🔥': [alexUser.id], '❤️': [sarahUser.id] }
      };

      this.data.messages.push(welcomeMsg);
      groupConv.lastMessageId = welcomeMsg.id;

      // Seed direct chat between Alex and Sarah
      const directConv: Conversation = {
        id: 'conv_direct_alex_sarah',
        type: 'direct',
        createdBy: alexUser.id,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now
      };

      this.data.conversations.push(directConv);
      this.data.conversationMembers.push(
        { id: 'cmd_1', conversationId: directConv.id, userId: alexUser.id, role: 'member', joinedAt: now, unreadCount: 0, isMuted: false },
        { id: 'cmd_2', conversationId: directConv.id, userId: sarahUser.id, role: 'member', joinedAt: now, unreadCount: 0, isMuted: false }
      );

      const directMsg: Message = {
        id: 'm_alex_1',
        conversationId: directConv.id,
        senderId: alexUser.id,
        text: 'Hey Sarah! Tested the new voice recorder feature on mobile PWA, works seamlessly.',
        type: 'text',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        reactions: { '👏': [sarahUser.id] }
      };

      this.data.messages.push(directMsg);
      directConv.lastMessageId = directMsg.id;

      this.save();
    }
  }

  // Schema getters
  get users() { return this.data.users; }
  get contacts() { return this.data.contacts; }
  get conversations() { return this.data.conversations; }
  get conversationMembers() { return this.data.conversationMembers; }
  get messages() { return this.data.messages; }
  get attachments() { return this.data.attachments; }
  get reactions() { return this.data.reactions; }
  get blockedUsers() { return this.data.blockedUsers; }
  get reports() { return this.data.reports; }
  get sessions() { return this.data.sessions; }
}

export const db = new Database();
