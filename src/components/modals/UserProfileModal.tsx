import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Users,
  Shield,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Ban,
  AlertTriangle,
  LogOut,
  Edit2,
  Check,
  Phone,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ConversationDetail, User as UserType } from '../../types/index.ts';

interface UserProfileModalProps {
  isOpen: boolean;
  conversationId?: string | null;
  targetUserId?: string | null;
  onClose: () => void;
  onBlockChange?: () => void;
  onLeaveConversation?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  conversationId,
  targetUserId,
  onClose,
  onBlockChange,
  onLeaveConversation
}) => {
  const { token, user: currentUser } = useAuth();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [profileUser, setProfileUser] = useState<UserType | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Group edit state
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');

  // Add member state
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [memberError, setMemberError] = useState('');

  useEffect(() => {
    if (!isOpen || !token) return;
    setIsLoading(true);

    if (conversationId) {
      fetch(`/api/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d.conversation) {
            setConversation(d.conversation);
            setGroupName(d.conversation.title);
            setGroupDescription(d.conversation.description || '');
            setGroupAvatar(d.conversation.avatarUrl || '');

            if (d.conversation.type === 'direct' && d.conversation.recipient) {
              setProfileUser(d.conversation.recipient);
              checkBlocked(d.conversation.recipient.id);
            }
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else if (targetUserId) {
      fetch(`/api/users/${targetUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d.user) {
            setProfileUser(d.user);
            setIsBlocked(d.isBlocked || false);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, conversationId, targetUserId, token]);

  const checkBlocked = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setIsBlocked(data.isBlocked || false);
    } catch {
      // Ignore
    }
  };

  if (!isOpen) return null;

  const handleToggleBlock = async () => {
    if (!profileUser || !token) return;
    try {
      if (isBlocked) {
        await fetch(`/api/blocked/${profileUser.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsBlocked(false);
      } else {
        await fetch('/api/blocked', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ blockedUserId: profileUser.id })
        });
        setIsBlocked(true);
      }
      onBlockChange?.();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveGroupInfo = async () => {
    if (!conversation || !token) return;
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim(),
          avatarUrl: groupAvatar
        })
      });
      if (res.ok) {
        setIsEditingGroup(false);
        setConversation(prev => prev ? {
          ...prev,
          title: groupName.trim(),
          description: groupDescription.trim(),
          avatarUrl: groupAvatar
        } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromoteDemote = async (memberUserId: string, newRole: 'admin' | 'member') => {
    if (!conversation || !token) return;
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/members/${memberUserId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setConversation(prev => prev ? {
          ...prev,
          members: prev.members.map(m => m.userId === memberUserId ? { ...m, role: newRole } : m)
        } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!conversation || !token) return;
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/members/${memberUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setConversation(prev => prev ? {
          ...prev,
          members: prev.members.filter(m => m.userId !== memberUserId)
        } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUsername.trim() || !conversation || !token) return;
    setMemberError('');

    try {
      const searchRes = await fetch(`/api/users/search?q=${encodeURIComponent(newMemberUsername.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const searchData = await searchRes.json();
      const targetUser = (searchData.users || []).find(
        (u: any) => u.username.toLowerCase() === newMemberUsername.trim().toLowerCase()
      );

      if (!targetUser) {
        setMemberError('User @' + newMemberUsername + ' not found');
        return;
      }

      const addRes = await fetch(`/api/conversations/${conversation.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: targetUser.id })
      });

      const addData = await addRes.json();
      if (!addRes.ok) throw new Error(addData.error || 'Failed to add member');

      setConversation(prev => prev ? {
        ...prev,
        members: [...prev.members, { id: `cm_${Date.now()}`, userId: targetUser.id, role: 'member', joinedAt: new Date().toISOString(), user: targetUser }]
      } : null);

      setIsAddingMember(false);
      setNewMemberUsername('');
    } catch (err: any) {
      setMemberError(err.message || 'Error adding member');
    }
  };

  const handleLeaveGroup = async () => {
    if (!conversation || !token) return;
    if (!confirm('Are you sure you want to leave this group?')) return;

    try {
      await fetch(`/api/conversations/${conversation.id}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      onLeaveConversation?.();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const isGroup = conversation?.type === 'group';
  const isGroupAdmin = conversation?.role === 'admin' || conversation?.role === 'creator';
  const isGroupCreator = conversation?.role === 'creator';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header with Avatar Banner */}
        <div className="relative bg-gradient-to-b from-sky-500/20 via-sky-500/5 to-transparent p-6 pb-4 flex flex-col items-center border-b border-slate-100 dark:border-slate-800/80">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <img
            src={isGroup ? conversation?.avatarUrl : profileUser?.avatarUrl}
            alt="Avatar"
            className="w-20 h-20 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-lg mb-3"
          />

          <h3 className="text-base font-bold text-slate-900 dark:text-white text-center">
            {isGroup ? conversation?.title : profileUser?.displayName}
          </h3>

          {!isGroup && profileUser && (
            <p className="text-xs text-sky-500 font-medium">@{profileUser.username}</p>
          )}

          {isGroup && conversation && (
            <p className="text-xs text-slate-500 mt-0.5">
              {conversation.members.length} members • Group Chat
            </p>
          )}
        </div>

        {/* Details & Actions */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* User Profile View */}
          {!isGroup && profileUser && (
            <div className="space-y-4">
              {profileUser.bio && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bio</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{profileUser.bio}</p>
                </div>
              )}

              {profileUser.phone && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                  <Phone className="w-4 h-4 text-sky-500" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Phone</p>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{profileUser.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                <Calendar className="w-4 h-4 text-sky-500" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Member Since</p>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    {new Date(profileUser.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={handleToggleBlock}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition ${
                    isBlocked
                      ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-500 hover:bg-sky-100'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500 hover:bg-rose-100'
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Group Profile View */}
          {isGroup && conversation && (
            <div className="space-y-4">
              {/* Group Description */}
              {isEditingGroup ? (
                <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Group Name</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
                    <textarea
                      rows={2}
                      value={groupDescription}
                      onChange={e => setGroupDescription(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsEditingGroup(false)}
                      className="px-3 py-1 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveGroupInfo}
                      className="px-3 py-1 bg-sky-500 text-white rounded-lg text-xs font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">About</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {conversation.description || 'No description provided.'}
                    </p>
                  </div>
                  {isGroupAdmin && (
                    <button
                      onClick={() => setIsEditingGroup(true)}
                      className="p-1 text-slate-400 hover:text-sky-500"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Members Header & Add Member Button */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Members ({conversation.members.length})
                  </h4>
                  {isGroupAdmin && !isAddingMember && (
                    <button
                      onClick={() => setIsAddingMember(true)}
                      className="text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Member</span>
                    </button>
                  )}
                </div>

                {isAddingMember && (
                  <form onSubmit={handleAddMember} className="mb-3 p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-900 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMemberUsername}
                        onChange={e => setNewMemberUsername(e.target.value)}
                        placeholder="Enter @username to add..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-semibold"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingMember(false);
                          setMemberError('');
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {memberError && <p className="text-[11px] text-rose-500">{memberError}</p>}
                  </form>
                )}

                {/* Members list */}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {conversation.members.map(m => {
                    const u = m.user;
                    if (!u) return null;
                    const isMe = u.id === currentUser?.id;

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <img src={u.avatarUrl} alt={u.displayName} className="w-7 h-7 rounded-full object-cover" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {u.displayName}
                              {isMe && <span className="text-[10px] text-slate-400">(You)</span>}
                            </p>
                            <p className="text-[10px] text-slate-400">@{u.username}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.role === 'creator'
                              ? 'bg-amber-500/10 text-amber-500'
                              : m.role === 'admin'
                              ? 'bg-sky-500/10 text-sky-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {m.role}
                          </span>

                          {/* Role actions if I am creator */}
                          {isGroupCreator && !isMe && m.role !== 'creator' && (
                            <button
                              onClick={() => handlePromoteDemote(u.id, m.role === 'admin' ? 'member' : 'admin')}
                              className="p-1 text-slate-400 hover:text-sky-500 transition"
                              title={m.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Remove member button */}
                          {isGroupAdmin && !isMe && m.role !== 'creator' && (
                            <button
                              onClick={() => handleRemoveMember(u.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition"
                              title="Remove from group"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leave group */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleLeaveGroup}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave Group</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
