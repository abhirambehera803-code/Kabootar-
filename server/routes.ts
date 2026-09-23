import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db, User, Conversation, Message, MessageAttachment, ConversationMember } from './db.ts';
import { requireAuth, requireAdmin, generateToken, AuthRequest } from './auth.ts';
import { realtime } from './ws.ts';

export const router = Router();

// Configure Multer for secure file uploads
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

/* ========================================================================= */
/*                              AUTH ENDPOINTS                               */
/* ========================================================================= */

// Register
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, username, displayName, phone } = req.body;

    if (!email || !password || !username || !displayName) {
      return res.status(400).json({ error: 'All fields (email, password, username, displayName) are required' });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters (letters, numbers, underscores)' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email or username taken
    const existingEmail = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existingEmail) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const existingUsername = db.users.find(u => u.username === cleanUsername);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const newUser: User = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      passwordHash,
      username: cleanUsername,
      displayName: displayName.trim(),
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUsername}`,
      bio: 'Hey there! I am using Aether Messenger.',
      role: db.users.length === 0 ? 'admin' : 'user',
      isSuspended: false,
      status: 'online',
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
      notificationSettings: { enabled: true, sound: true, showPreview: true },
      privacySettings: { phoneVisibility: 'contacts', lastSeenVisibility: 'everyone' }
    };

    db.users.push(newUser);

    // Automatically join the Welcome group if exists
    const welcomeGroup = db.conversations.find(c => c.id === 'conv_welcome_group');
    if (welcomeGroup) {
      db.conversationMembers.push({
        id: `cm_${Date.now()}_${newUser.id}`,
        conversationId: welcomeGroup.id,
        userId: newUser.id,
        role: 'member',
        joinedAt: now,
        unreadCount: 0,
        isMuted: false
      });
    }

    db.save();

    const token = generateToken(newUser);
    return res.status(201).json({
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your username/email and password' });
    }

    const query = identifier.trim().toLowerCase();
    const user = db.users.find(u => u.email.toLowerCase() === query || u.username.toLowerCase() === query || (u.phone && u.phone === query));

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: 'Your account has been suspended' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    user.status = 'online';
    user.lastSeen = new Date().toISOString();
    db.save();

    const token = generateToken(user);

    // Track active session
    const session = {
      id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: user.id,
      token,
      deviceInfo: req.headers['user-agent'] || 'Web Browser',
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    db.sessions.push(session);
    db.save();

    return res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Forgot Password
router.post('/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    // Return friendly message even if not found for security
    return res.json({ message: 'If that email exists in our system, a password reset code has been issued.', resetToken: 'DEMO-RESET-CODE' });
  }
  const resetToken = `reset-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  return res.json({
    message: 'Password reset code generated.',
    resetToken,
    hint: 'Use this code in the password reset form.'
  });
});

// Reset Password
router.post('/auth/reset-password', async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  if (!email || !newPassword || !resetToken) {
    return res.status(400).json({ error: 'Email, reset token, and new password are required' });
  }
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  db.save();

  return res.json({ message: 'Password updated successfully. Please log in.' });
});

// Current user
router.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  return res.json({ user: sanitizeUser(req.user!) });
});

// Update profile
router.put('/auth/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { displayName, username, bio, phone, avatarUrl, notificationSettings, privacySettings } = req.body;

  if (username && username.trim().toLowerCase() !== user.username) {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    const taken = db.users.find(u => u.username === clean && u.id !== user.id);
    if (taken) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    user.username = clean;
  }

  if (displayName) user.displayName = displayName.trim();
  if (bio !== undefined) user.bio = bio.trim();
  if (phone !== undefined) user.phone = phone.trim();
  if (avatarUrl) user.avatarUrl = avatarUrl;
  if (notificationSettings) user.notificationSettings = { ...user.notificationSettings, ...notificationSettings };
  if (privacySettings) user.privacySettings = { ...user.privacySettings, ...privacySettings };

  user.updatedAt = new Date().toISOString();
  db.save();

  realtime.broadcast({
    type: 'user:profile_updated',
    user: sanitizeUser(user)
  });

  return res.json({ user: sanitizeUser(user) });
});

// Change password
router.put('/auth/password', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  db.save();

  return res.json({ message: 'Password changed successfully' });
});

// Active Sessions
router.get('/auth/sessions', requireAuth, (req: AuthRequest, res: Response) => {
  const sessions = db.sessions.filter(s => s.userId === req.user!.id);
  return res.json({ sessions });
});

router.delete('/auth/sessions/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const idx = db.sessions.findIndex(s => s.id === req.params.id && s.userId === req.user!.id);
  if (idx !== -1) {
    db.sessions.splice(idx, 1);
    db.save();
  }
  return res.json({ message: 'Session revoked' });
});

/* ========================================================================= */
/*                              CONTACTS & USERS                             */
/* ========================================================================= */

// Search users
router.get('/users/search', requireAuth, (req: AuthRequest, res: Response) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  if (!q) return res.json({ users: [] });

  const currentUserId = req.user!.id;
  const matches = db.users
    .filter(u => u.id !== currentUserId && !u.isSuspended)
    .filter(u => u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q) || (u.phone && u.phone.includes(q)))
    .slice(0, 20)
    .map(sanitizeUser);

  return res.json({ users: matches });
});

// Get user public profile
router.get('/users/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user || user.isSuspended) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isBlocked = db.blockedUsers.some(b => b.blockerId === req.user!.id && b.blockedUserId === user.id);
  const hasBlockedMe = db.blockedUsers.some(b => b.blockerId === user.id && b.blockedUserId === req.user!.id);

  return res.json({
    user: sanitizeUser(user),
    isBlocked,
    hasBlockedMe
  });
});

// Get contacts
router.get('/contacts', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const contactEntries = db.contacts.filter(c => c.userId === currentUserId);
  const contacts = contactEntries.map(c => {
    const user = db.users.find(u => u.id === c.contactUserId);
    return user ? sanitizeUser(user) : null;
  }).filter(Boolean);

  return res.json({ contacts });
});

// Add contact
router.post('/contacts', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { contactUserId, username } = req.body;

  let targetUser = contactUserId ? db.users.find(u => u.id === contactUserId) : null;
  if (!targetUser && username) {
    targetUser = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (targetUser.id === currentUserId) {
    return res.status(400).json({ error: 'Cannot add yourself to contacts' });
  }

  const existing = db.contacts.find(c => c.userId === currentUserId && c.contactUserId === targetUser!.id);
  if (!existing) {
    db.contacts.push({
      id: `c_${Date.now()}`,
      userId: currentUserId,
      contactUserId: targetUser.id,
      createdAt: new Date().toISOString()
    });
    db.save();
  }

  return res.json({ contact: sanitizeUser(targetUser) });
});

// Remove contact
router.delete('/contacts/:contactUserId', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const idx = db.contacts.findIndex(c => c.userId === currentUserId && c.contactUserId === req.params.contactUserId);
  if (idx !== -1) {
    db.contacts.splice(idx, 1);
    db.save();
  }
  return res.json({ message: 'Contact removed' });
});

/* ========================================================================= */
/*                              CONVERSATIONS                                */
/* ========================================================================= */

// List user conversations
router.get('/conversations', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const userMemberships = db.conversationMembers.filter(m => m.userId === currentUserId);

  const list = userMemberships.map(membership => {
    const conv = db.conversations.find(c => c.id === membership.conversationId);
    if (!conv) return null;

    let title = conv.name || '';
    let avatarUrl = conv.avatarUrl || '';
    let recipient: any = null;

    if (conv.type === 'direct') {
      const otherMember = db.conversationMembers.find(m => m.conversationId === conv.id && m.userId !== currentUserId);
      if (otherMember) {
        const otherUser = db.users.find(u => u.id === otherMember.userId);
        if (otherUser) {
          title = otherUser.displayName;
          avatarUrl = otherUser.avatarUrl;
          recipient = sanitizeUser(otherUser);
        }
      }
    }

    // Get last message
    const lastMsg = conv.lastMessageId ? db.messages.find(m => m.id === conv.lastMessageId) : null;

    // Member count for groups
    const memberCount = db.conversationMembers.filter(m => m.conversationId === conv.id).length;

    return {
      id: conv.id,
      type: conv.type,
      title,
      avatarUrl,
      description: conv.description,
      recipient,
      memberCount,
      role: membership.role,
      unreadCount: membership.unreadCount,
      isMuted: membership.isMuted,
      lastMessage: lastMsg ? formatMessage(lastMsg) : null,
      lastActivityAt: conv.lastActivityAt
    };
  }).filter(Boolean);

  // Sort descending by lastActivityAt
  list.sort((a, b) => new Date(b!.lastActivityAt).getTime() - new Date(a!.lastActivityAt).getTime());

  return res.json({ conversations: list });
});

// Get or Create Direct Conversation
router.post('/conversations/direct', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { recipientUserId } = req.body;

  if (!recipientUserId) {
    return res.status(400).json({ error: 'recipientUserId is required' });
  }

  if (recipientUserId === currentUserId) {
    return res.status(400).json({ error: 'Cannot start direct chat with yourself' });
  }

  const recipient = db.users.find(u => u.id === recipientUserId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient user not found' });
  }

  // Check if direct conversation already exists between these two
  const existingConv = db.conversations.find(c => {
    if (c.type !== 'direct') return false;
    const members = db.conversationMembers.filter(m => m.conversationId === c.id);
    const hasMe = members.some(m => m.userId === currentUserId);
    const hasThem = members.some(m => m.userId === recipientUserId);
    return hasMe && hasThem;
  });

  if (existingConv) {
    return res.json({ conversationId: existingConv.id });
  }

  // Create new direct conversation
  const now = new Date().toISOString();
  const newConv: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'direct',
    createdBy: currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now
  };

  db.conversations.push(newConv);

  db.conversationMembers.push(
    { id: `cm_${Date.now()}_1`, conversationId: newConv.id, userId: currentUserId, role: 'member', joinedAt: now, unreadCount: 0, isMuted: false },
    { id: `cm_${Date.now()}_2`, conversationId: newConv.id, userId: recipientUserId, role: 'member', joinedAt: now, unreadCount: 0, isMuted: false }
  );

  db.save();

  // Notify recipient
  realtime.sendToUser(recipientUserId, {
    type: 'conversation:created',
    conversationId: newConv.id
  });

  return res.status(201).json({ conversationId: newConv.id });
});

// Create Group Conversation
router.post('/conversations/group', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { name, description, avatarUrl, memberIds } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const now = new Date().toISOString();
  const newConv: Conversation = {
    id: `conv_g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'group',
    name: name.trim(),
    description: description ? description.trim() : '',
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
    createdBy: currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now
  };

  db.conversations.push(newConv);

  // Add creator as creator/admin
  db.conversationMembers.push({
    id: `cm_${Date.now()}_creator`,
    conversationId: newConv.id,
    userId: currentUserId,
    role: 'creator',
    joinedAt: now,
    unreadCount: 0,
    isMuted: false
  });

  // Add initial members
  const memberSet = new Set<string>(Array.isArray(memberIds) ? memberIds : []);
  memberSet.delete(currentUserId);

  memberSet.forEach(memberId => {
    if (db.users.some(u => u.id === memberId)) {
      db.conversationMembers.push({
        id: `cm_${Date.now()}_${memberId}`,
        conversationId: newConv.id,
        userId: memberId,
        role: 'member',
        joinedAt: now,
        unreadCount: 0,
        isMuted: false
      });
      // Notify them
      realtime.sendToUser(memberId, {
        type: 'conversation:created',
        conversationId: newConv.id
      });
    }
  });

  // System welcome message
  const creator = db.users.find(u => u.id === currentUserId);
  const sysMsg: Message = {
    id: `m_sys_${Date.now()}`,
    conversationId: newConv.id,
    senderId: currentUserId,
    text: `${creator?.displayName || 'Creator'} created group "${name}"`,
    type: 'text',
    isEdited: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  };
  db.messages.push(sysMsg);
  newConv.lastMessageId = sysMsg.id;

  db.save();

  return res.status(201).json({ conversationId: newConv.id });
});

// Get Conversation Details
router.get('/conversations/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conv = db.conversations.find(c => c.id === req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const myMembership = db.conversationMembers.find(m => m.conversationId === conv.id && m.userId === currentUserId);
  if (!myMembership) {
    return res.status(403).json({ error: 'You are not a member of this conversation' });
  }

  const members = db.conversationMembers
    .filter(m => m.conversationId === conv.id)
    .map(m => {
      const user = db.users.find(u => u.id === m.userId);
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: user ? sanitizeUser(user) : null
      };
    });

  let title = conv.name || '';
  let avatarUrl = conv.avatarUrl || '';
  let recipient: any = null;

  if (conv.type === 'direct') {
    const other = members.find(m => m.userId !== currentUserId);
    if (other && other.user) {
      title = other.user.displayName;
      avatarUrl = other.user.avatarUrl;
      recipient = other.user;
    }
  }

  return res.json({
    conversation: {
      id: conv.id,
      type: conv.type,
      title,
      avatarUrl,
      description: conv.description,
      createdBy: conv.createdBy,
      createdAt: conv.createdAt,
      role: myMembership.role,
      isMuted: myMembership.isMuted,
      recipient,
      members
    }
  });
});

// Update group conversation
router.put('/conversations/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conv = db.conversations.find(c => c.id === req.params.id);
  if (!conv || conv.type !== 'group') {
    return res.status(404).json({ error: 'Group conversation not found' });
  }

  const membership = db.conversationMembers.find(m => m.conversationId === conv.id && m.userId === currentUserId);
  if (!membership || (membership.role !== 'admin' && membership.role !== 'creator')) {
    return res.status(403).json({ error: 'Only administrators can edit group details' });
  }

  const { name, description, avatarUrl } = req.body;
  if (name) conv.name = name.trim();
  if (description !== undefined) conv.description = description.trim();
  if (avatarUrl) conv.avatarUrl = avatarUrl;
  conv.updatedAt = new Date().toISOString();

  db.save();

  realtime.sendToConversation(conv.id, {
    type: 'conversation:updated',
    conversationId: conv.id,
    name: conv.name,
    description: conv.description,
    avatarUrl: conv.avatarUrl
  });

  return res.json({ conversation: conv });
});

// Add member to group
router.post('/conversations/:id/members', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conv = db.conversations.find(c => c.id === req.params.id);
  if (!conv || conv.type !== 'group') {
    return res.status(404).json({ error: 'Group conversation not found' });
  }

  const myMembership = db.conversationMembers.find(m => m.conversationId === conv.id && m.userId === currentUserId);
  if (!myMembership || (myMembership.role !== 'admin' && myMembership.role !== 'creator')) {
    return res.status(403).json({ error: 'Only group admins can add members' });
  }

  const { userId } = req.body;
  if (!userId || !db.users.some(u => u.id === userId)) {
    return res.status(400).json({ error: 'Invalid user' });
  }

  const existing = db.conversationMembers.find(m => m.conversationId === conv.id && m.userId === userId);
  if (existing) {
    return res.status(400).json({ error: 'User is already a member of this group' });
  }

  const now = new Date().toISOString();
  db.conversationMembers.push({
    id: `cm_${Date.now()}_${userId}`,
    conversationId: conv.id,
    userId,
    role: 'member',
    joinedAt: now,
    unreadCount: 0,
    isMuted: false
  });

  db.save();

  const addedUser = db.users.find(u => u.id === userId);
  realtime.sendToConversation(conv.id, {
    type: 'member:added',
    conversationId: conv.id,
    user: addedUser ? sanitizeUser(addedUser) : null
  });

  realtime.sendToUser(userId, {
    type: 'conversation:created',
    conversationId: conv.id
  });

  return res.json({ message: 'Member added successfully' });
});

// Remove member from group
router.delete('/conversations/:id/members/:userId', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { id: conversationId, userId: targetUserId } = req.params;

  const conv = db.conversations.find(c => c.id === conversationId);
  if (!conv || conv.type !== 'group') {
    return res.status(404).json({ error: 'Group conversation not found' });
  }

  const myMembership = db.conversationMembers.find(m => m.conversationId === conv.id && m.userId === currentUserId);
  if (!myMembership || (myMembership.role !== 'admin' && myMembership.role !== 'creator')) {
    return res.status(403).json({ error: 'Only group admins can remove members' });
  }

  const targetMemberIdx = db.conversationMembers.findIndex(m => m.conversationId === conv.id && m.userId === targetUserId);
  if (targetMemberIdx === -1) {
    return res.status(404).json({ error: 'Member not found in this group' });
  }

  const targetMember = db.conversationMembers[targetMemberIdx];
  if (targetMember.role === 'creator') {
    return res.status(400).json({ error: 'Cannot remove the group creator' });
  }

  db.conversationMembers.splice(targetMemberIdx, 1);
  db.save();

  realtime.sendToConversation(conv.id, {
    type: 'member:removed',
    conversationId: conv.id,
    userId: targetUserId
  });

  return res.json({ message: 'Member removed' });
});

// Promote/Demote member role
router.put('/conversations/:id/members/:userId/role', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { id: conversationId, userId: targetUserId } = req.params;
  const { role } = req.body; // 'admin' or 'member'

  const conv = db.conversations.find(c => c.id === conversationId);
  if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Group not found' });

  const myMembership = db.conversationMembers.find(m => m.conversationId === conv.id && m.userId === currentUserId);
  if (!myMembership || myMembership.role !== 'creator') {
    return res.status(403).json({ error: 'Only the group creator can assign roles' });
  }

  const targetMember = db.conversationMembers.find(m => m.conversationId === conv.id && m.userId === targetUserId);
  if (!targetMember) return res.status(404).json({ error: 'Member not found' });

  if (targetMember.role === 'creator') return res.status(400).json({ error: 'Cannot change creator role' });
  if (role !== 'admin' && role !== 'member') return res.status(400).json({ error: 'Invalid role' });

  targetMember.role = role;
  db.save();

  realtime.sendToConversation(conv.id, {
    type: 'member:role_updated',
    conversationId: conv.id,
    userId: targetUserId,
    role
  });

  return res.json({ message: 'Role updated successfully' });
});

// Leave group
router.post('/conversations/:id/leave', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conv = db.conversations.find(c => c.id === req.params.id);
  if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Group not found' });

  const idx = db.conversationMembers.findIndex(m => m.conversationId === conv.id && m.userId === currentUserId);
  if (idx === -1) return res.status(400).json({ error: 'You are not a member' });

  db.conversationMembers.splice(idx, 1);
  db.save();

  realtime.sendToConversation(conv.id, {
    type: 'member:left',
    conversationId: conv.id,
    userId: currentUserId
  });

  return res.json({ message: 'Left group successfully' });
});

// Mark conversation read
router.post('/conversations/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const member = db.conversationMembers.find(m => m.conversationId === req.params.id && m.userId === currentUserId);
  if (member) {
    member.unreadCount = 0;
    const lastMsg = db.conversations.find(c => c.id === req.params.id)?.lastMessageId;
    if (lastMsg) member.lastReadMessageId = lastMsg;
    db.save();

    realtime.sendToConversation(req.params.id, {
      type: 'message:read',
      conversationId: req.params.id,
      userId: currentUserId
    });
  }
  return res.json({ success: true });
});

/* ========================================================================= */
/*                                MESSAGES                                   */
/* ========================================================================= */

// Fetch conversation messages
router.get('/conversations/:id/messages', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conversationId = req.params.id;

  const isMember = db.conversationMembers.some(m => m.conversationId === conversationId && m.userId === currentUserId);
  if (!isMember) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const query = ((req.query.q as string) || '').trim().toLowerCase();
  let msgs = db.messages.filter(m => m.conversationId === conversationId && !m.isDeleted);

  if (query) {
    msgs = msgs.filter(m => m.text.toLowerCase().includes(query));
  }

  // Paginate
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  // Most recent first or chronological: we send chronological for chat display
  const sliced = msgs.slice(Math.max(0, msgs.length - limit - offset), msgs.length - offset);
  const formatted = sliced.map(formatMessage);

  return res.json({
    messages: formatted,
    total: msgs.length
  });
});

// Send message
router.post('/messages', requireAuth, (req: AuthRequest, res: Response) => {
  const senderId = req.user!.id;
  const { conversationId, text, type = 'text', replyToId, forwardedFrom, attachment } = req.body;

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  const conv = db.conversations.find(c => c.id === conversationId);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const membership = db.conversationMembers.find(m => m.conversationId === conversationId && m.userId === senderId);
  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this conversation' });
  }

  // Check if blocked in direct chat
  if (conv.type === 'direct') {
    const otherMember = db.conversationMembers.find(m => m.conversationId === conversationId && m.userId !== senderId);
    if (otherMember) {
      const isBlocked = db.blockedUsers.some(b => (b.blockerId === senderId && b.blockedUserId === otherMember.userId) || (b.blockerId === otherMember.userId && b.blockedUserId === senderId));
      if (isBlocked) {
        return res.status(403).json({ error: 'Cannot send message because one of the users is blocked' });
      }
    }
  }

  const now = new Date().toISOString();
  const messageId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  let finalAttachment: MessageAttachment | undefined = undefined;
  if (attachment) {
    finalAttachment = {
      id: `att_${Date.now()}`,
      messageId,
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName || 'Attachment',
      fileSize: attachment.fileSize || 0,
      mimeType: attachment.mimeType || 'application/octet-stream',
      durationSeconds: attachment.durationSeconds
    };
    db.attachments.push(finalAttachment);
  }

  const newMsg: Message = {
    id: messageId,
    conversationId,
    senderId,
    text: text ? text.trim() : '',
    type,
    replyToId,
    forwardedFrom,
    isEdited: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    attachment: finalAttachment,
    reactions: {}
  };

  db.messages.push(newMsg);

  // Update conversation activity
  conv.lastMessageId = messageId;
  conv.lastActivityAt = now;

  // Increment unread count for other members
  db.conversationMembers.forEach(m => {
    if (m.conversationId === conversationId && m.userId !== senderId) {
      m.unreadCount = (m.unreadCount || 0) + 1;
    }
  });

  db.save();

  const formatted = formatMessage(newMsg);

  // Broadcast in real-time via WebSocket
  realtime.sendToConversation(conversationId, {
    type: 'message:new',
    message: formatted,
    conversationId
  });

  return res.status(201).json({ message: formatted });
});

// Edit message
router.put('/messages/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const msg = db.messages.find(m => m.id === req.params.id);
  if (!msg || msg.isDeleted) {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (msg.senderId !== currentUserId) {
    return res.status(403).json({ error: 'You can only edit your own messages' });
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text cannot be empty' });
  }

  msg.text = text.trim();
  msg.isEdited = true;
  msg.updatedAt = new Date().toISOString();
  db.save();

  const formatted = formatMessage(msg);
  realtime.sendToConversation(msg.conversationId, {
    type: 'message:edited',
    message: formatted
  });

  return res.json({ message: formatted });
});

// Delete message
router.delete('/messages/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const msg = db.messages.find(m => m.id === req.params.id);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const conv = db.conversations.find(c => c.id === msg.conversationId);
  const membership = db.conversationMembers.find(m => m.conversationId === msg.conversationId && m.userId === currentUserId);
  const isGroupAdmin = conv?.type === 'group' && (membership?.role === 'admin' || membership?.role === 'creator');
  const isSystemAdmin = req.user!.role === 'admin';

  if (msg.senderId !== currentUserId && !isGroupAdmin && !isSystemAdmin) {
    return res.status(403).json({ error: 'Permission denied to delete this message' });
  }

  msg.isDeleted = true;
  msg.text = 'This message was deleted';
  msg.updatedAt = new Date().toISOString();
  db.save();

  realtime.sendToConversation(msg.conversationId, {
    type: 'message:deleted',
    messageId: msg.id,
    conversationId: msg.conversationId
  });

  return res.json({ message: 'Message deleted' });
});

// Toggle reaction
router.post('/messages/:id/react', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

  const msg = db.messages.find(m => m.id === req.params.id);
  if (!msg || msg.isDeleted) return res.status(404).json({ error: 'Message not found' });

  if (!msg.reactions) msg.reactions = {};

  const userList = msg.reactions[emoji] || [];
  const existingIdx = userList.indexOf(currentUserId);

  if (existingIdx !== -1) {
    // Remove reaction
    userList.splice(existingIdx, 1);
    if (userList.length === 0) {
      delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji] = userList;
    }
  } else {
    // Add reaction
    userList.push(currentUserId);
    msg.reactions[emoji] = userList;
  }

  db.save();

  realtime.sendToConversation(msg.conversationId, {
    type: 'message:reaction',
    messageId: msg.id,
    conversationId: msg.conversationId,
    reactions: msg.reactions
  });

  return res.json({ reactions: msg.reactions });
});

// Forward messages
router.post('/messages/forward', requireAuth, (req: AuthRequest, res: Response) => {
  const senderId = req.user!.id;
  const { messageIds, targetConversationId } = req.body;

  if (!Array.isArray(messageIds) || messageIds.length === 0 || !targetConversationId) {
    return res.status(400).json({ error: 'messageIds array and targetConversationId are required' });
  }

  const targetConv = db.conversations.find(c => c.id === targetConversationId);
  if (!targetConv) return res.status(404).json({ error: 'Target conversation not found' });

  const isMember = db.conversationMembers.some(m => m.conversationId === targetConversationId && m.userId === senderId);
  if (!isMember) return res.status(403).json({ error: 'You are not a member of the target conversation' });

  const forwardedMsgs: any[] = [];
  const now = new Date().toISOString();

  messageIds.forEach(mid => {
    const orig = db.messages.find(m => m.id === mid && !m.isDeleted);
    if (!orig) return;

    const originalSender = db.users.find(u => u.id === orig.senderId);
    const newId = `m_fwd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let attachmentCopy: MessageAttachment | undefined = undefined;
    if (orig.attachment) {
      attachmentCopy = {
        ...orig.attachment,
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        messageId: newId
      };
      db.attachments.push(attachmentCopy);
    }

    const fwdMsg: Message = {
      id: newId,
      conversationId: targetConversationId,
      senderId,
      text: orig.text,
      type: orig.type,
      forwardedFrom: originalSender?.displayName || 'Forwarded',
      isEdited: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      attachment: attachmentCopy,
      reactions: {}
    };

    db.messages.push(fwdMsg);
    targetConv.lastMessageId = newId;
    targetConv.lastActivityAt = now;

    const formatted = formatMessage(fwdMsg);
    forwardedMsgs.push(formatted);

    realtime.sendToConversation(targetConversationId, {
      type: 'message:new',
      message: formatted,
      conversationId: targetConversationId
    });
  });

  db.save();

  return res.json({ messages: forwardedMsgs });
});

/* ========================================================================= */
/*                              FILE UPLOADS                                 */
/* ========================================================================= */

router.post('/upload', requireAuth, upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/api/uploads/${req.file.filename}`;
  const durationSeconds = req.body.durationSeconds ? parseFloat(req.body.durationSeconds) : undefined;

  return res.json({
    fileUrl,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    durationSeconds
  });
});

router.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (req.query.download === '1') {
    return res.download(filePath);
  }
  return res.sendFile(filePath);
});

/* ========================================================================= */
/*                              BLOCK & REPORT                               */
/* ========================================================================= */

router.get('/blocked', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const blockedEntries = db.blockedUsers.filter(b => b.blockerId === currentUserId);
  const blockedUsers = blockedEntries.map(b => {
    const u = db.users.find(user => user.id === b.blockedUserId);
    return u ? sanitizeUser(u) : null;
  }).filter(Boolean);

  return res.json({ blockedUsers });
});

router.post('/blocked', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { blockedUserId } = req.body;
  if (!blockedUserId) return res.status(400).json({ error: 'blockedUserId is required' });
  if (blockedUserId === currentUserId) return res.status(400).json({ error: 'Cannot block yourself' });

  const existing = db.blockedUsers.find(b => b.blockerId === currentUserId && b.blockedUserId === blockedUserId);
  if (!existing) {
    db.blockedUsers.push({
      id: `b_${Date.now()}`,
      blockerId: currentUserId,
      blockedUserId,
      createdAt: new Date().toISOString()
    });
    db.save();
  }

  return res.json({ message: 'User blocked' });
});

router.delete('/blocked/:blockedUserId', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const idx = db.blockedUsers.findIndex(b => b.blockerId === currentUserId && b.blockedUserId === req.params.blockedUserId);
  if (idx !== -1) {
    db.blockedUsers.splice(idx, 1);
    db.save();
  }
  return res.json({ message: 'User unblocked' });
});

router.post('/reports', requireAuth, (req: AuthRequest, res: Response) => {
  const reporterId = req.user!.id;
  const { targetType, targetId, reason, details } = req.body;

  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ error: 'targetType, targetId, and reason are required' });
  }

  const report = {
    id: `rep_${Date.now()}`,
    reporterId,
    targetType,
    targetId,
    reason,
    details: details || '',
    status: 'pending' as const,
    createdAt: new Date().toISOString()
  };

  db.reports.push(report);
  db.save();

  return res.status(201).json({ message: 'Report submitted. Our safety team will review it.' });
});

/* ========================================================================= */
/*                              ADMIN DASHBOARD                              */
/* ========================================================================= */

router.get('/admin/stats', requireAdmin, (_req: AuthRequest, res: Response) => {
  return res.json({
    totalUsers: db.users.length,
    activeUsers: db.users.filter(u => u.status === 'online').length,
    totalConversations: db.conversations.length,
    totalMessages: db.messages.filter(m => !m.isDeleted).length,
    pendingReports: db.reports.filter(r => r.status === 'pending').length,
    totalAttachments: db.attachments.length
  });
});

router.get('/admin/users', requireAdmin, (_req: AuthRequest, res: Response) => {
  const list = db.users.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    lastSeen: u.lastSeen,
    isSuspended: u.isSuspended,
    createdAt: u.createdAt
  }));
  return res.json({ users: list });
});

router.put('/admin/users/:id/suspend', requireAdmin, (req: AuthRequest, res: Response) => {
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(400).json({ error: 'Cannot suspend an administrator' });

  target.isSuspended = !target.isSuspended;
  target.updatedAt = new Date().toISOString();
  db.save();

  return res.json({ user: sanitizeUser(target) });
});

router.get('/admin/reports', requireAdmin, (_req: AuthRequest, res: Response) => {
  const reports = db.reports.map(r => {
    const reporter = db.users.find(u => u.id === r.reporterId);
    let targetPreview = '';
    if (r.targetType === 'message') {
      const msg = db.messages.find(m => m.id === r.targetId);
      targetPreview = msg ? msg.text : '[Message not found]';
    } else {
      const u = db.users.find(usr => usr.id === r.targetId);
      targetPreview = u ? `@${u.username} (${u.displayName})` : '[User not found]';
    }

    return {
      ...r,
      reporterName: reporter?.displayName || 'Unknown',
      targetPreview
    };
  });

  return res.json({ reports });
});

router.put('/admin/reports/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const report = db.reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const { status } = req.body;
  if (status !== 'resolved' && status !== 'dismissed') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  report.status = status;
  db.save();

  return res.json({ report });
});

router.delete('/admin/messages/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const msg = db.messages.find(m => m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  msg.isDeleted = true;
  msg.text = '[Content removed by administration for violation of Community Guidelines]';
  msg.updatedAt = new Date().toISOString();
  db.save();

  realtime.sendToConversation(msg.conversationId, {
    type: 'message:deleted',
    messageId: msg.id,
    conversationId: msg.conversationId
  });

  return res.json({ message: 'Message removed by administration' });
});

/* ========================================================================= */
/*                              HELPERS                                      */
/* ========================================================================= */

function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    status: user.status,
    lastSeen: user.lastSeen,
    createdAt: user.createdAt,
    notificationSettings: user.notificationSettings,
    privacySettings: user.privacySettings
  };
}

function formatMessage(msg: Message) {
  const sender = db.users.find(u => u.id === msg.senderId);
  const replyToMsg = msg.replyToId ? db.messages.find(m => m.id === msg.replyToId) : null;
  let replyPreview = null;
  if (replyToMsg) {
    const replySender = db.users.find(u => u.id === replyToMsg.senderId);
    replyPreview = {
      id: replyToMsg.id,
      text: replyToMsg.text,
      senderName: replySender?.displayName || 'Unknown',
      type: replyToMsg.type
    };
  }

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderName: sender?.displayName || 'Unknown',
    senderUsername: sender?.username || 'unknown',
    senderAvatar: sender?.avatarUrl || '',
    text: msg.text,
    type: msg.type,
    replyTo: replyPreview,
    forwardedFrom: msg.forwardedFrom,
    isEdited: msg.isEdited,
    isDeleted: msg.isDeleted,
    createdAt: msg.createdAt,
    attachment: msg.attachment,
    reactions: msg.reactions || {}
  };
}
