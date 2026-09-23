import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Info,
  Shield,
  Trash2,
  Share2,
  X,
  Phone,
  Video,
  ChevronDown
} from 'lucide-react';
import { Message, ConversationDetail } from '../../types/index.ts';
import { MessageItem } from './MessageItem.tsx';
import { MessageInput } from './MessageInput.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useWebSocket } from '../../context/WebSocketContext.tsx';

interface ChatAreaProps {
  conversationId: string;
  onBack: () => void;
  onOpenProfile: () => void;
  onOpenMedia: (url: string, type: 'image' | 'video', fileName?: string) => void;
  onOpenForward: (messageIds: string[]) => void;
  onOpenReport: (messageId: string, text: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversationId,
  onBack,
  onOpenProfile,
  onOpenMedia,
  onOpenForward,
  onOpenReport
}) => {
  const { token, user: currentUser } = useAuth();
  const {
    activeTyping,
    activeRecording,
    presenceMap,
    sendTyping,
    sendRecording,
    markConversationRead,
    subscribeToEvents
  } = useWebSocket();

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search inside chat
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Reply and Edit state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Multi-select state
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const isSelectionMode = selectedMessageIds.length > 0;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch conversation detail and messages
  useEffect(() => {
    if (!conversationId || !token) return;
    setIsLoading(true);

    Promise.all([
      fetch(`/api/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()),
      fetch(`/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json())
    ])
      .then(([convData, msgData]) => {
        if (convData.conversation) setConversation(convData.conversation);
        if (msgData.messages) setMessages(msgData.messages);
        markConversationRead(conversationId);
      })
      .catch(console.error)
      .finally(() => {
        setIsLoading(false);
        scrollToBottom();
      });
  }, [conversationId, token]);

  // Subscribe to real-time events for this conversation
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event: any) => {
      if (event.conversationId !== conversationId) return;

      if (event.type === 'message:new') {
        setMessages(prev => {
          if (prev.some(m => m.id === event.message.id)) return prev;
          return [...prev, event.message];
        });
        markConversationRead(conversationId, event.message.id);
        scrollToBottom();
      } else if (event.type === 'message:edited') {
        setMessages(prev => prev.map(m => m.id === event.message.id ? event.message : m));
      } else if (event.type === 'message:deleted') {
        setMessages(prev => prev.filter(m => m.id !== event.messageId));
      } else if (event.type === 'message:reaction') {
        setMessages(prev =>
          prev.map(m => (m.id === event.messageId ? { ...m, reactions: event.reactions } : m))
        );
      } else if (event.type === 'conversation:updated') {
        setConversation(prev => prev ? {
          ...prev,
          title: event.name || prev.title,
          description: event.description ?? prev.description,
          avatarUrl: event.avatarUrl || prev.avatarUrl
        } : null);
      }
    });

    return () => unsubscribe();
  }, [conversationId, subscribeToEvents]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (payload: {
    text: string;
    type?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file';
    replyToId?: string;
    attachment?: any;
  }) => {
    if (!token) return;

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId,
          ...payload
        })
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: newText })
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages(prev => prev.map(m => m.id === messageId ? data.message : m));
      }
    } catch (err) {
      console.error('Failed to edit message', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emoji })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch (err) {
      console.error('Failed to react', err);
    }
  };

  const handleToggleSelect = (messageId: string) => {
    setSelectedMessageIds(prev =>
      prev.includes(messageId) ? prev.filter(id => id !== messageId) : [...prev, messageId]
    );
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedMessageIds.length} message(s)?`)) return;
    for (const id of selectedMessageIds) {
      await handleDeleteMessage(id);
    }
    setSelectedMessageIds([]);
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-sky-500/20');
      setTimeout(() => el.classList.remove('bg-sky-500/20'), 1500);
    }
  };

  // Status subtitle calculation
  const getStatusSubtitle = () => {
    const typingUsers = activeTyping[conversationId] || [];
    const recordingUsers = activeRecording[conversationId] || [];

    if (recordingUsers.length > 0) {
      return (
        <span className="text-rose-500 font-semibold animate-pulse flex items-center gap-1">
          <span>🎤</span>
          <span>{recordingUsers.join(', ')} recording voice...</span>
        </span>
      );
    }

    if (typingUsers.length > 0) {
      return (
        <span className="text-sky-500 font-semibold animate-pulse">
          {typingUsers.join(', ')} typing...
        </span>
      );
    }

    if (conversation?.type === 'group') {
      const memberCount = conversation.members.length;
      return <span>{memberCount} members</span>;
    }

    if (conversation?.recipient) {
      const presence = presenceMap[conversation.recipient.id];
      const status = presence ? presence.status : conversation.recipient.status;
      if (status === 'online') {
        return <span className="text-emerald-500 font-semibold">online</span>;
      }
      return <span>offline</span>;
    }

    return null;
  };

  // Group messages by calendar date for sticky date dividers
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const renderMessageGroups = () => {
    let lastDate = '';
    return filteredMessages.map(msg => {
      const dateStr = new Date(msg.createdAt).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const showDateDivider = dateStr !== lastDate;
      lastDate = dateStr;

      return (
        <React.Fragment key={msg.id}>
          {showDateDivider && (
            <div className="flex justify-center my-3 sticky top-2 z-10 select-none">
              <span className="px-3 py-1 bg-slate-200/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold rounded-full shadow-sm backdrop-blur-sm">
                {dateStr}
              </span>
            </div>
          )}
          <MessageItem
            message={msg}
            isMe={msg.senderId === currentUser?.id}
            isGroup={conversation?.type === 'group'}
            isSelected={selectedMessageIds.includes(msg.id)}
            isSelectionMode={isSelectionMode}
            onToggleSelect={handleToggleSelect}
            onReply={m => setReplyingTo(m)}
            onEdit={m => setEditingMessage(m)}
            onDelete={handleDeleteMessage}
            onForward={id => onOpenForward([id])}
            onReact={handleReact}
            onReport={(id, text) => onOpenReport(id, text)}
            onOpenMedia={onOpenMedia}
            onScrollToMessage={handleScrollToMessage}
          />
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden relative">
      {/* Conversation Header */}
      <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            onClick={onOpenProfile}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
          >
            <div className="relative shrink-0">
              <img
                src={conversation?.avatarUrl}
                alt={conversation?.title}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
              {conversation?.type === 'direct' && conversation.recipient && (
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                  (presenceMap[conversation.recipient.id]?.status || conversation.recipient.status) === 'online'
                    ? 'bg-emerald-500'
                    : 'bg-slate-400'
                }`} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-sky-500 transition">
                {conversation?.title || 'Loading...'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {getStatusSubtitle()}
              </p>
            </div>
          </div>
        </div>

        {/* Header Action buttons */}
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-500 transition"
            title="Search in chat"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenProfile}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-500 transition"
            title="View Info"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* In-Chat Search Bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <span className="text-[11px] text-slate-400">
              {filteredMessages.length} found
            </span>
          )}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Multi-Selection Action Header Banner */}
      {isSelectionMode && (
        <div className="bg-sky-500 text-white px-4 py-2 flex items-center justify-between shadow-md z-10 animate-fade-in">
          <span className="text-xs font-semibold">
            {selectedMessageIds.length} message{selectedMessageIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenForward(selectedMessageIds)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium flex items-center gap-1 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Forward</span>
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1 bg-rose-600/80 hover:bg-rose-600 rounded-lg text-xs font-medium flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
            <button
              onClick={() => setSelectedMessageIds([])}
              className="p-1 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Message Stream Scroll Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto py-3 space-y-0.5"
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
            Loading message stream...
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Info className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No messages yet</h4>
            <p className="text-xs text-slate-500 max-w-xs">
              Say hello or send a voice message to get the conversation started!
            </p>
          </div>
        ) : (
          renderMessageGroups()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer Input */}
      <MessageInput
        conversationId={conversationId}
        members={conversation?.members || []}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onTyping={isTyping => sendTyping(conversationId, isTyping)}
        onRecording={isRec => sendRecording(conversationId, isRec)}
        token={token}
      />
    </div>
  );
};
