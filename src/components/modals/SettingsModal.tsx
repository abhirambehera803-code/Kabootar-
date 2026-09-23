import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Bell,
  Lock,
  Sun,
  Moon,
  Laptop,
  LogOut,
  Camera,
  Check,
  Smartphone,
  Trash2,
  Ban
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useWebSocket } from '../../context/WebSocketContext.tsx';
import { PWAInstallButton } from '../PWAInstallButton.tsx';
import { UserSession } from '../../types/index.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, changePassword, logout, token } = useAuth();
  const { theme, setTheme } = useTheme();
  const { requestNotificationPermission, notificationsEnabled } = useWebSocket();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'privacy' | 'appearance'>('profile');

  // Profile fields
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<UserSession[]>([]);

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);

  // Notification toggles
  const [soundEnabled, setSoundEnabled] = useState(user?.notificationSettings?.sound ?? true);
  const [previewEnabled, setPreviewEnabled] = useState(user?.notificationSettings?.showPreview ?? true);

  // Privacy toggles
  const [phoneVisibility, setPhoneVisibility] = useState<'everyone' | 'contacts' | 'nobody'>(user?.privacySettings?.phoneVisibility || 'contacts');
  const [lastSeenVisibility, setLastSeenVisibility] = useState<'everyone' | 'contacts' | 'nobody'>(user?.privacySettings?.lastSeenVisibility || 'everyone');

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setUsername(user.username);
      setBio(user.bio || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || '');
      setSoundEnabled(user.notificationSettings?.sound ?? true);
      setPreviewEnabled(user.notificationSettings?.showPreview ?? true);
      setPhoneVisibility(user.privacySettings?.phoneVisibility || 'contacts');
      setLastSeenVisibility(user.privacySettings?.lastSeenVisibility || 'everyone');
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen || !token) return;
    if (activeTab === 'security') {
      fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setSessions(data.sessions || []))
        .catch(console.error);
    } else if (activeTab === 'privacy') {
      fetch('/api/blocked', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setBlockedUsers(data.blockedUsers || []))
        .catch(console.error);
    }
  }, [isOpen, activeTab, token]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.fileUrl) {
        setAvatarUrl(data.fileUrl);
        await updateProfile({ avatarUrl: data.fileUrl });
      }
    } catch (err) {
      console.error('Failed to upload avatar', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileError('');
    setProfileSuccess(false);

    try {
      await updateProfile({
        displayName,
        username,
        bio,
        phone,
        avatarUrl
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setIsUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSaveNotifications = async (sound: boolean, preview: boolean) => {
    setSoundEnabled(sound);
    setPreviewEnabled(preview);
    await updateProfile({
      notificationSettings: {
        enabled: true,
        sound,
        showPreview: preview
      }
    });
  };

  const handleSavePrivacy = async (phoneVis: any, lastSeenVis: any) => {
    setPhoneVisibility(phoneVis);
    setLastSeenVisibility(lastSeenVis);
    await updateProfile({
      privacySettings: {
        phoneVisibility: phoneVis,
        lastSeenVisibility: lastSeenVis
      }
    });
  };

  const handleUnblock = async (blockedUserId: string) => {
    try {
      await fetch(`/api/blocked/${blockedUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setBlockedUsers(prev => prev.filter(u => u.id !== blockedUserId));
    } catch (err) {
      console.error('Failed to unblock user', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-56 p-4 bg-slate-50 dark:bg-slate-950/60 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 shrink-0 flex md:flex-col justify-between overflow-x-auto">
          <div className="space-y-1 w-full flex md:flex-col gap-1 md:gap-0">
            <h3 className="hidden md:block text-xs font-bold uppercase tracking-wider text-slate-400 px-3 py-2">
              Settings
            </h3>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'profile'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'security'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Security</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'notifications'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'privacy'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Privacy</span>
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'appearance'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Appearance</span>
            </button>
          </div>

          <div className="hidden md:block pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 p-6 overflow-y-auto relative flex flex-col">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Tab 1: Profile */}
          {activeTab === 'profile' && (
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Edit Profile</h3>

              {profileSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Profile updated successfully!</span>
                </div>
              )}
              {profileError && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-xl text-xs">
                  {profileError}
                </div>
              )}

              {/* Avatar section */}
              <div className="flex items-center gap-4 mb-6">
                <div className="relative group">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 rounded-2xl bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px] font-semibold mt-1">Change</span>
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{displayName}</h4>
                  <p className="text-xs text-slate-500">@{username}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Click the photo to upload your custom avatar</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Username *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">@</span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full pl-7 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Tell other people about yourself..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 555-0100"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
                  >
                    {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Change Password</h3>
                {passwordSuccess && (
                  <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>Password updated successfully!</span>
                  </div>
                )}
                {passwordError && (
                  <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-xl text-xs">
                    {passwordError}
                  </div>
                )}
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
                    >
                      {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Sessions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-500" />
                  <span>Active Devices & Sessions</span>
                </h4>
                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <p className="text-xs text-slate-500">Current device is active.</p>
                  ) : (
                    sessions.map(s => (
                      <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[260px]">{s.deviceInfo}</p>
                          <p className="text-[11px] text-slate-400">Logged in: {new Date(s.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-500 font-bold rounded">Active</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Notification Preferences</h3>

              <div className="p-4 bg-sky-50 dark:bg-sky-950/30 rounded-2xl border border-sky-100 dark:border-sky-900 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-sky-950 dark:text-sky-200">Browser Desktop Notifications</h4>
                  <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-0.5">
                    Receive alert banners even when the browser tab is in the background.
                  </p>
                </div>
                <button
                  onClick={requestNotificationPermission}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    notificationsEnabled
                      ? 'bg-emerald-500 text-white'
                      : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                >
                  {notificationsEnabled ? 'Enabled' : 'Enable'}
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Message Sound Chime</h5>
                    <p className="text-[11px] text-slate-400">Play a subtle alert tone when new messages arrive</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={e => handleSaveNotifications(e.target.checked, previewEnabled)}
                    className="w-4 h-4 text-sky-500 rounded focus:ring-sky-400"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Message Preview</h5>
                    <p className="text-[11px] text-slate-400">Show message text snippet in notification popups</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={previewEnabled}
                    onChange={e => handleSaveNotifications(soundEnabled, e.target.checked)}
                    className="w-4 h-4 text-sky-500 rounded focus:ring-sky-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Privacy */}
          {activeTab === 'privacy' && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Privacy & Security</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Who can see my phone number?
                  </label>
                  <select
                    value={phoneVisibility}
                    onChange={e => handleSavePrivacy(e.target.value, lastSeenVisibility)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="contacts">My Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Who can see my Last Seen / Online status?
                  </label>
                  <select
                    value={lastSeenVisibility}
                    onChange={e => handleSavePrivacy(phoneVisibility, e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="contacts">My Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>
              </div>

              {/* Blocked Users */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-rose-500" />
                  <span>Blocked Users ({blockedUsers.length})</span>
                </h4>
                {blockedUsers.length === 0 ? (
                  <p className="text-xs text-slate-400">You haven't blocked any users.</p>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <img src={b.avatarUrl} alt={b.displayName} className="w-7 h-7 rounded-full object-cover" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{b.displayName}</p>
                            <p className="text-[10px] text-slate-400">@{b.username}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnblock(b.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 5: Appearance */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Appearance & Theme</h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Theme Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition ${
                      theme === 'light'
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                    <span className="text-xs font-semibold">Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition ${
                      theme === 'dark'
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Moon className="w-5 h-5" />
                    <span className="text-xs font-semibold">Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition ${
                      theme === 'system'
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Laptop className="w-5 h-5" />
                    <span className="text-xs font-semibold">System</span>
                  </button>
                </div>
              </div>

              {/* Install PWA section */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">Progressive Web App (PWA)</h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  Install Aether onto your home screen or dock for instant startup and offline capability.
                </p>
                <div className="w-full max-w-xs">
                  <PWAInstallButton variant="sidebar" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
