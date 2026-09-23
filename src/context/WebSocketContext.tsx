import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Message } from '../types/index.ts';

interface WebSocketContextType {
  isConnected: boolean;
  activeTyping: { [conversationId: string]: string[] };
  activeRecording: { [conversationId: string]: string[] };
  presenceMap: { [userId: string]: { status: 'online' | 'offline'; lastSeen: string } };
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  sendRecording: (conversationId: string, isRecording: boolean) => void;
  markConversationRead: (conversationId: string, messageId?: string) => void;
  subscribeToEvents: (listener: (event: any) => void) => () => void;
  requestNotificationPermission: () => Promise<void>;
  notificationsEnabled: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Web Audio synthesizer chime for incoming messages
function playIncomingChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [activeTyping, setActiveTyping] = useState<{ [conversationId: string]: string[] }>({});
  const [activeRecording, setActiveRecording] = useState<{ [conversationId: string]: string[] }>({});
  const [presenceMap, setPresenceMap] = useState<{ [userId: string]: { status: 'online' | 'offline'; lastSeen: string } }>({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const eventListenersRef = useRef<Set<(event: any) => void>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationsEnabled(perm === 'granted');
    }
  };

  const connect = useCallback(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      socketRef.current = null;
      // Auto-reconnect after 2 seconds
      if (token && !reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 2000);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle typing
        if (data.type === 'typing:start') {
          const { conversationId, displayName, userId } = data;
          if (userId !== user?.id) {
            setActiveTyping(prev => {
              const current = prev[conversationId] || [];
              if (!current.includes(displayName || 'Someone')) {
                return { ...prev, [conversationId]: [...current, displayName || 'Someone'] };
              }
              return prev;
            });
          }
        } else if (data.type === 'typing:stop') {
          const { conversationId, displayName } = data;
          setActiveTyping(prev => {
            const current = prev[conversationId] || [];
            return { ...prev, [conversationId]: current.filter(n => n !== (displayName || 'Someone')) };
          });
        }

        // Handle voice recording
        if (data.type === 'voice:start') {
          const { conversationId, displayName, userId } = data;
          if (userId !== user?.id) {
            setActiveRecording(prev => {
              const current = prev[conversationId] || [];
              if (!current.includes(displayName || 'Someone')) {
                return { ...prev, [conversationId]: [...current, displayName || 'Someone'] };
              }
              return prev;
            });
          }
        } else if (data.type === 'voice:stop') {
          const { conversationId, displayName } = data;
          setActiveRecording(prev => {
            const current = prev[conversationId] || [];
            return { ...prev, [conversationId]: current.filter(n => n !== (displayName || 'Someone')) };
          });
        }

        // Handle presence updates
        if (data.type === 'presence:update') {
          const { userId, status, lastSeen } = data;
          setPresenceMap(prev => ({
            ...prev,
            [userId]: { status, lastSeen }
          }));
        }

        // Handle incoming message chime and notifications
        if (data.type === 'message:new') {
          const msg: Message = data.message;
          if (msg.senderId !== user?.id) {
            // Sound
            if (user?.notificationSettings?.sound !== false) {
              playIncomingChime();
            }

            // Desktop push notification if permitted and document not focused
            if (Notification.permission === 'granted' && document.hidden) {
              const notifTitle = msg.senderName || 'New Message';
              const notifBody = msg.type === 'voice'
                ? '🎤 Sent a voice message'
                : msg.type === 'image'
                ? '📷 Sent a photo'
                : msg.text;
              try {
                new Notification(notifTitle, {
                  body: notifBody,
                  icon: '/pwa-192x192.png'
                });
              } catch {
                // Ignore notification errors
              }
            }
          }
        }

        // Notify all registered listeners
        eventListenersRef.current.forEach(listener => {
          try {
            listener(data);
          } catch (err) {
            console.error('Error in event listener:', err);
          }
        });
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };
  }, [token, user]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendTyping = (conversationId: string, isTyping: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: isTyping ? 'typing:start' : 'typing:stop',
        conversationId
      }));
    }
  };

  const sendRecording = (conversationId: string, isRecording: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: isRecording ? 'voice:start' : 'voice:stop',
        conversationId
      }));
    }
  };

  const markConversationRead = (conversationId: string, messageId?: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'message:read',
        conversationId,
        messageId
      }));
    }
  };

  const subscribeToEvents = (listener: (event: any) => void) => {
    eventListenersRef.current.add(listener);
    return () => {
      eventListenersRef.current.delete(listener);
    };
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        activeTyping,
        activeRecording,
        presenceMap,
        sendTyping,
        sendRecording,
        markConversationRead,
        subscribeToEvents,
        requestNotificationPermission,
        notificationsEnabled
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return context;
};
