import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext.tsx';
import { AuthScreen } from './components/auth/AuthScreen.tsx';
import { Sidebar } from './components/sidebar/Sidebar.tsx';
import { ChatArea } from './components/chat/ChatArea.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { NewGroupModal } from './components/modals/NewGroupModal.tsx';
import { NewContactModal } from './components/modals/NewContactModal.tsx';
import { SettingsModal } from './components/modals/SettingsModal.tsx';
import { AdminDashboardModal } from './components/modals/AdminDashboardModal.tsx';
import { MediaLightboxModal } from './components/modals/MediaLightboxModal.tsx';
import { ForwardModal } from './components/modals/ForwardModal.tsx';
import { UserProfileModal } from './components/modals/UserProfileModal.tsx';
import { ReportModal } from './components/modals/ReportModal.tsx';
import { ConversationSummary } from './types/index.ts';
import { MessageSquare, ShieldCheck, Zap, Lock } from 'lucide-react';

const MessengerApp: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const { subscribeToEvents } = useWebSocket();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Modals state
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [profileModalConvId, setProfileModalConvId] = useState<string | null>(null);

  // Lightbox modal
  const [lightboxData, setLightboxData] = useState<{
    url: string | null;
    type: 'image' | 'video' | null;
    fileName?: string;
  }>({ url: null, type: null });

  // Forward modal
  const [forwardMessageIds, setForwardMessageIds] = useState<string[]>([]);
  const [showForwardModal, setShowForwardModal] = useState(false);

  // Report modal
  const [reportData, setReportData] = useState<{
    isOpen: boolean;
    targetType: 'user' | 'message';
    targetId: string;
    targetName?: string;
  }>({ isOpen: false, targetType: 'message', targetId: '' });

  // Fetch conversations
  const fetchConversations = () => {
    if (!token) return;
    fetch('/api/conversations', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.conversations) {
          setConversations(data.conversations);
          // If no active conversation, pick the first one on desktop
          if (!activeConversationId && window.innerWidth >= 768 && data.conversations.length > 0) {
            setActiveConversationId(data.conversations[0].id);
          }
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchConversations();
  }, [token]);

  // Subscribe to real-time events that affect the conversation list
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event: any) => {
      if (
        event.type === 'message:new' ||
        event.type === 'conversation:created' ||
        event.type === 'conversation:updated' ||
        event.type === 'message:read'
      ) {
        fetchConversations();
      }
    });
    return () => unsubscribe();
  }, [subscribeToEvents]);

  // Start direct conversation with user
  const handleStartDirectChat = async (recipientUserId: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/conversations/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipientUserId })
      });
      const data = await res.json();
      if (res.ok && data.conversationId) {
        fetchConversations();
        setActiveConversationId(data.conversationId);
      }
    } catch (err) {
      console.error('Failed to start chat', err);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white select-none">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-sky-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-sky-500/40 animate-pulse mb-4">
          <MessageSquare className="w-7 h-7 fill-current" />
        </div>
        <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Loading Aether...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased select-none">
      <OfflineIndicator />

      {/* Responsive layout: on mobile, show Sidebar or ChatArea based on activeConversationId */}
      <div className={`w-full md:w-auto h-full flex ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={id => setActiveConversationId(id)}
          onOpenNewGroup={() => setShowNewGroup(true)}
          onOpenNewContact={() => setShowNewContact(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenAdmin={() => setShowAdmin(true)}
        />
      </div>

      {/* Chat View Area */}
      <div className={`flex-1 h-full flex flex-col ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {activeConversationId ? (
          <ChatArea
            conversationId={activeConversationId}
            onBack={() => setActiveConversationId(null)}
            onOpenProfile={() => setProfileModalConvId(activeConversationId)}
            onOpenMedia={(url, type, fileName) => setLightboxData({ url, type, fileName })}
            onOpenForward={ids => {
              setForwardMessageIds(ids);
              setShowForwardModal(true);
            }}
            onOpenReport={(msgId, text) => {
              setReportData({
                isOpen: true,
                targetType: 'message',
                targetId: msgId,
                targetName: text ? `"${text.substring(0, 40)}..."` : 'Message'
              });
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 dark:bg-slate-950/40 select-none">
            <div className="w-20 h-20 rounded-3xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-5 shadow-inner">
              <MessageSquare className="w-10 h-10 fill-current" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Select a conversation to start messaging
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
              Send encrypted text, voice notes with live waveforms, photos, and files across all your devices.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-md text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <Zap className="w-4 h-4 text-sky-500 mb-1 mx-auto" />
                <span className="font-bold block">Instant</span>
                <span className="text-[10px] text-slate-400">WebSocket sync</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <Lock className="w-4 h-4 text-emerald-500 mb-1 mx-auto" />
                <span className="font-bold block">Private</span>
                <span className="text-[10px] text-slate-400">Granular privacy</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-indigo-500 mb-1 mx-auto" />
                <span className="font-bold block">PWA</span>
                <span className="text-[10px] text-slate-400">Works offline</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewGroupModal
        isOpen={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        onGroupCreated={newId => {
          fetchConversations();
          setActiveConversationId(newId);
        }}
      />

      <NewContactModal
        isOpen={showNewContact}
        onClose={() => setShowNewContact(false)}
        onStartChat={userId => handleStartDirectChat(userId)}
        onContactAdded={() => fetchConversations()}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <AdminDashboardModal
        isOpen={showAdmin}
        onClose={() => setShowAdmin(false)}
      />

      <MediaLightboxModal
        mediaUrl={lightboxData.url}
        mediaType={lightboxData.type}
        fileName={lightboxData.fileName}
        onClose={() => setLightboxData({ url: null, type: null })}
      />

      <ForwardModal
        isOpen={showForwardModal}
        messageIds={forwardMessageIds}
        conversations={conversations}
        onClose={() => {
          setShowForwardModal(false);
          setForwardMessageIds([]);
        }}
        onForwardComplete={targetId => {
          setActiveConversationId(targetId);
          fetchConversations();
        }}
      />

      <UserProfileModal
        isOpen={profileModalConvId !== null}
        conversationId={profileModalConvId}
        onClose={() => setProfileModalConvId(null)}
        onBlockChange={() => fetchConversations()}
        onLeaveConversation={() => {
          setActiveConversationId(null);
          fetchConversations();
        }}
      />

      <ReportModal
        isOpen={reportData.isOpen}
        targetType={reportData.targetType}
        targetId={reportData.targetId}
        targetName={reportData.targetName}
        onClose={() => setReportData(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <MessengerApp />
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
