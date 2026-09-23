import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './auth.ts';
import { db } from './db.ts';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export class RealtimeManager {
  private wss: WebSocketServer | null = null;
  private userSockets: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  public init(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      ws.isAlive = true;

      // Check token in url query
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      if (token) {
        this.authenticateSocket(ws, token);
      }

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          this.handleClientMessage(ws, data);
        } catch (err) {
          console.error('WS message error:', err);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('WS socket error:', err);
        this.handleDisconnect(ws);
      });
    });

    // Ping / keep-alive every 30s
    this.pingInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((client) => {
        const ws = client as AuthenticatedWebSocket;
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private authenticateSocket(ws: AuthenticatedWebSocket, token: string) {
    const payload = verifyToken(token);
    if (!payload) {
      ws.send(JSON.stringify({ type: 'auth:failed', error: 'Invalid token' }));
      return;
    }

    const userId = payload.id;
    ws.userId = userId;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(ws);

    // Update user status to online
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.status = 'online';
      user.lastSeen = new Date().toISOString();
      db.save();

      this.broadcastPresence(userId, 'online', user.lastSeen);
    }

    ws.send(JSON.stringify({
      type: 'auth:success',
      userId,
      timestamp: new Date().toISOString()
    }));
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    if (!ws.userId) return;
    const userId = ws.userId;
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        // Mark user as offline
        const user = db.users.find(u => u.id === userId);
        if (user) {
          user.status = 'offline';
          user.lastSeen = new Date().toISOString();
          db.save();
          this.broadcastPresence(userId, 'offline', user.lastSeen);
        }
      }
    }
  }

  private handleClientMessage(ws: AuthenticatedWebSocket, data: any) {
    if (data.type === 'auth') {
      this.authenticateSocket(ws, data.token);
      return;
    }

    if (!ws.userId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthenticated socket' }));
      return;
    }

    const senderId = ws.userId;

    switch (data.type) {
      case 'typing:start':
      case 'typing:stop':
      case 'voice:start':
      case 'voice:stop': {
        const conversationId = data.conversationId;
        if (!conversationId) return;
        const sender = db.users.find(u => u.id === senderId);
        this.sendToConversation(conversationId, {
          type: data.type,
          conversationId,
          userId: senderId,
          username: sender?.username,
          displayName: sender?.displayName
        }, ws);
        break;
      }

      case 'message:read': {
        const { conversationId, messageId } = data;
        if (!conversationId) return;
        // Update member unread count in DB
        const member = db.conversationMembers.find(m => m.conversationId === conversationId && m.userId === senderId);
        if (member) {
          member.unreadCount = 0;
          if (messageId) member.lastReadMessageId = messageId;
          db.save();
        }
        // Broadcast read receipt to all conversation members (and other tabs of sender)
        this.sendToConversation(conversationId, {
          type: 'message:read',
          conversationId,
          userId: senderId,
          messageId
        });
        break;
      }
    }
  }

  public broadcastPresence(userId: string, status: 'online' | 'offline', lastSeen: string) {
    const payload = JSON.stringify({
      type: 'presence:update',
      userId,
      status,
      lastSeen
    });
    if (!this.wss) return;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  public sendToUser(userId: string, message: any) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    const payload = JSON.stringify(message);
    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  public sendToConversation(conversationId: string, message: any, excludeSocket?: WebSocket) {
    const members = db.conversationMembers.filter(m => m.conversationId === conversationId);
    const payload = JSON.stringify(message);

    members.forEach((member) => {
      const sockets = this.userSockets.get(member.userId);
      if (sockets) {
        sockets.forEach((ws) => {
          if (ws !== excludeSocket && ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        });
      }
    });
  }

  public broadcast(message: any) {
    const payload = JSON.stringify(message);
    if (!this.wss) return;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}

export const realtime = new RealtimeManager();
