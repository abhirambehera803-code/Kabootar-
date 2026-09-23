import React, { useState } from 'react';
import { X, Share2, Search, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ConversationSummary } from '../../types/index.ts';

interface ForwardModalProps {
  isOpen: boolean;
  messageIds: string[];
  conversations: ConversationSummary[];
  onClose: () => void;
  onForwardComplete: (targetConversationId: string) => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  messageIds,
  conversations,
  onClose,
  onForwardComplete
}) => {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleForward = async () => {
    if (!selectedTargetId || !token || messageIds.length === 0) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/messages/forward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          messageIds,
          targetConversationId: selectedTargetId
        })
      });

      if (res.ok) {
        onForwardComplete(selectedTargetId);
        onClose();
      }
    } catch (err) {
      console.error('Failed to forward messages', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Forward Messages</h3>
              <p className="text-[11px] text-slate-400">{messageIds.length} message{messageIds.length > 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chat to forward to..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="p-2 overflow-y-auto flex-1 space-y-1">
          {filteredConversations.map(conv => {
            const isSelected = selectedTargetId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedTargetId(conv.id)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition select-none ${
                  isSelected
                    ? 'bg-sky-50 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img src={conv.avatarUrl} alt={conv.title} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{conv.title}</h4>
                    <p className="text-[11px] text-slate-400">
                      {conv.type === 'group' ? `${conv.memberCount} members` : 'Direct message'}
                    </p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                  isSelected ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={!selectedTargetId || isSubmitting}
            className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Forwarding...' : 'Forward'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
