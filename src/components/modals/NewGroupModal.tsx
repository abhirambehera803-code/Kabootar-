import React, { useState, useEffect } from 'react';
import { X, Users, Search, Check, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { User } from '../../types/index.ts';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (conversationId: string) => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({ isOpen, onClose, onGroupCreated }) => {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !token) return;
    fetch('/api/contacts', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.contacts) setContacts(data.contacts);
      })
      .catch(console.error);
  }, [isOpen, token]);

  if (!isOpen) return null;

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a group name');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/conversations/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          memberIds: selectedUsers
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      onGroupCreated(data.conversationId);
      onClose();
      setName('');
      setDescription('');
      setSelectedUsers([]);
    } catch (err: any) {
      setError(err.message || 'Error creating group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredContacts = contacts.filter(c =>
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-900 dark:text-white">New Group Chat</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleCreate} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Project Apollo, Weekend Squad..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Add Members ({selectedUsers.length} selected)
              </label>
            </div>

            {/* Search filter for contacts */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-800 p-1 divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredContacts.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                  No contacts found. You can also add members after creating the group.
                </p>
              ) : (
                filteredContacts.map(c => {
                  const isChecked = selectedUsers.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleUser(c.id)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer transition select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <img src={c.avatarUrl} alt={c.displayName} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">{c.displayName}</p>
                          <p className="text-[11px] text-slate-500">@{c.username}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                        isChecked ? 'bg-sky-500 text-white' : 'border border-slate-300 dark:border-slate-600'
                      }`}>
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
