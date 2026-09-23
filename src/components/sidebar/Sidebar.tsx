import React, { useState } from 'react';
import {
  Search,
  Plus,
  Users,
  UserPlus,
  Settings,
  ShieldAlert,
  Sun,
  Moon,
  LogOut,
  MessageSquare,
  CheckCheck,
  Check
} from 'lucide-react';
import { ConversationSummary } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useWebSocket } from '../../context/WebSocketContext.tsx';
import { PWAInstallButton } from '../PWAInstallButton.tsx';

interface SidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewGroup: () => void;
  onOpenNewContact: () => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewGroup,
  onOpenNewContact,
  onOpenSettings,
  onOpenAdmin
}) => {
  const { user, logout } = useAuth();
  const { effectiveTheme, setTheme } = useTheme();
  const { activeTyping, activeRecording, presenceMap } = useWebSocket();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'direct' | 'groups' | 'unread'>('all');
  const [showNewMenu, setShowNewMenu] = useState(false);

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    // Tab filter
    if (activeFilter === 'direct' && conv.type !== 'direct') return false;
    if (activeFilter === 'groups' && conv.type !== 'group') return false;
    if (activeFilter === 'unread' && conv.unreadCount <= 0) return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = conv.title.toLowerCase().includes(q);
      const matchMsg = conv.lastMessage?.text.toLowerCase().includes(q);
      return matchTitle || matchMsg;
    }

    return true;
  });

  const formatLastTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 select-none">
      {/* Top Brand Bar */}
      <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 via-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <MessageSquare className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              Aether
            </h1>
            <p className="text-[10px] text-sky-500 font-semibold tracking-wider uppercase">
              Messenger
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          {/* PWA Install Button */}
          <PWAInstallButton variant="header" />

          {/* New Chat Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="w-8 h-8 rounded-xl bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition shadow-sm"
              title="New Conversation or Contact"
            >
              <Plus className="w-4 h-4" />
            </button>

            {showNewMenu && (
              <div
                className="absolute right-0 top-10 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1 z-30 text-xs text-slate-700 dark:text-slate-200"
                onMouseLeave={() => setShowNewMenu(false)}
              >
                <button
                  onClick={() => {
                    onOpenNewContact();
                    setShowNewMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5"
                >
                  <UserPlus className="w-4 h-4 text-sky-500" />
                  <span>Find Person / Chat</span>
                </button>
                <button
                  onClick={() => {
                    onOpenNewGroup();
                    setShowNewMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5"
                >
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>New Group</span>
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => {
                      onOpenAdmin();
                      setShowNewMenu(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-700"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Admin Controls</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats or messages..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex px-3 pt-3 gap-1 overflow-x-auto scrollbar-none">
        {(['all', 'direct', 'groups', 'unread'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition ${
              activeFilter === tab
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-slate-400 font-medium">No conversations found</p>
            <button
              onClick={onOpenNewContact}
              className="mt-2 text-xs text-sky-500 hover:underline font-semibold"
            >
              Start a new conversation
            </button>
          </div>
        ) : (
          filteredConversations.map(conv => {
            const isActive = conv.id === activeConversationId;
            const typingUsers = activeTyping[conv.id] || [];
            const recordingUsers = activeRecording[conv.id] || [];
            const isDirect = conv.type === 'direct';
            const recipientId = conv.recipient?.id;
            const recipientPresence = recipientId ? presenceMap[recipientId] : null;
            const isOnline = recipientPresence
              ? recipientPresence.status === 'online'
              : conv.recipient?.status === 'online';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition select-none ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-900 dark:text-white'
                }`}
              >
                {/* Avatar with online badge */}
                <div className="relative shrink-0">
                  <img
                    src={conv.avatarUrl}
                    alt={conv.title}
                    className="w-11 h-11 rounded-2xl object-cover"
                  />
                  {isDirect && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                        isActive ? 'border-sky-500' : 'border-white dark:border-slate-900'
                      } ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
                    />
                  )}
                </div>

                {/* Conversation info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h4 className="font-bold text-xs truncate">{conv.title}</h4>
                    <span
                      className={`text-[10px] font-mono shrink-0 ${
                        isActive ? 'text-white/80' : 'text-slate-400'
                      }`}
                    >
                      {formatLastTime(conv.lastActivityAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {/* Last message or typing state */}
                    <div className="truncate text-xs">
                      {recordingUsers.length > 0 ? (
                        <span className={`font-semibold animate-pulse ${isActive ? 'text-white' : 'text-rose-500'}`}>
                          🎤 recording voice...
                        </span>
                      ) : typingUsers.length > 0 ? (
                        <span className={`font-semibold animate-pulse ${isActive ? 'text-white' : 'text-sky-500'}`}>
                          typing...
                        </span>
                      ) : conv.lastMessage ? (
                        <span className={`truncate text-[11px] ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                          {conv.lastMessage.type === 'voice'
                            ? '🎤 Voice message'
                            : conv.lastMessage.type === 'image'
                            ? '📷 Photo'
                            : conv.lastMessage.text}
                        </span>
                      ) : (
                        <span className={`text-[11px] italic ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                          New conversation
                        </span>
                      )}
                    </div>

                    {/* Unread badge */}
                    {conv.unreadCount > 0 && !isActive && (
                      <span className="px-1.5 py-0.5 rounded-full bg-sky-500 text-white font-bold text-[10px] shrink-0 min-w-[18px] text-center shadow-sm">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Current User Bar */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between gap-2 shrink-0">
        <div
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 cursor-pointer group min-w-0"
        >
          <img
            src={user?.avatarUrl}
            alt={user?.displayName}
            className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
          />
          <div className="min-w-0">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-sky-500 transition">
              {user?.displayName}
            </h4>
            <p className="text-[10px] text-slate-400 truncate">@{user?.username}</p>
          </div>
        </div>

        {/* Quick controls: theme toggle & settings gear */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
            title={`Switch to ${effectiveTheme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {effectiveTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
