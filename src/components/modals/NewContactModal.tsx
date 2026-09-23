import React, { useState } from 'react';
import { X, UserPlus, Search, MessageSquare, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { User } from '../../types/index.ts';

interface NewContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (userId: string) => void;
  onContactAdded: () => void;
}

export const NewContactModal: React.FC<NewContactModalProps> = ({
  isOpen,
  onClose,
  onStartChat,
  onContactAdded
}) => {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;

    setIsSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(search.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.users || []);
      if (data.users.length === 0) {
        setError('No users found matching "' + search + '"');
      }
    } catch (err: any) {
      setError(err.message || 'Error searching users');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddContact = async (userId: string) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ contactUserId: userId })
      });
      if (res.ok) {
        setAddedIds(prev => [...prev, userId]);
        onContactAdded();
      }
    } catch (err) {
      console.error('Failed to add contact', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-900 dark:text-white">Find People & Add Contacts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-6 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by @username or display name..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !search.trim()}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {error && (
            <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 text-center">
              {error}
            </p>
          )}

          {/* Results list */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {results.map(user => {
              const isAdded = addedIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{user.displayName}</h4>
                      <p className="text-[11px] text-slate-500">@{user.username}</p>
                      {user.bio && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{user.bio}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAddContact(user.id)}
                      disabled={isAdded}
                      className={`p-2 rounded-xl text-xs font-semibold transition flex items-center gap-1 ${
                        isAdded
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                      }`}
                      title={isAdded ? 'Added' : 'Add to Contacts'}
                    >
                      {isAdded ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        onStartChat(user.id);
                        onClose();
                      }}
                      className="p-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition text-xs flex items-center gap-1"
                      title="Send Message"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
