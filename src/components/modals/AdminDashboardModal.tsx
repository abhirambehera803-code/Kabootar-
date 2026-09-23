import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Users,
  MessageSquare,
  AlertTriangle,
  HardDrive,
  UserCheck,
  UserX,
  Search,
  Trash2,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ReportItem } from '../../types/index.ts';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ isOpen, onClose }) => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'reports'>('stats');

  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<ReportItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !token || user?.role !== 'admin') return;

    setLoading(true);
    // Fetch stats
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(console.error);

    // Fetch users
    fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setUsersList(d.users || []))
      .catch(console.error);

    // Fetch reports
    fetch('/api/admin/reports', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setReportsList(d.reports || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, token, user]);

  if (!isOpen || user?.role !== 'admin') return null;

  const handleToggleSuspend = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsersList(prev =>
          prev.map(u => (u.id === userId ? { ...u, isSuspended: data.user.isSuspended } : u))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      setReportsList(prev =>
        prev.map(r => (r.id === reportId ? { ...r, status } : r))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReportedMessage = async (messageId: string, reportId: string) => {
    try {
      await fetch(`/api/admin/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      handleResolveReport(reportId, 'resolved');
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = usersList.filter(u =>
    u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Aether Administration Control Center</h2>
              <p className="text-[11px] text-slate-400">Moderation, Telemetry & User Governance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50 dark:bg-slate-950/40">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'stats'
                ? 'border-sky-500 text-sky-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Platform Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-sky-500 text-sky-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Management ({usersList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'border-sky-500 text-sky-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Moderation Reports ({reportsList.filter(r => r.status === 'pending').length} Pending)</span>
          </button>
        </div>

        {/* Content Panel */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50">
                  <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 mb-2">
                    <Users className="w-5 h-5" />
                    <span className="text-[11px] font-bold uppercase">Total Users</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.totalUsers ?? '...'}</p>
                  <p className="text-[11px] text-sky-600/80 mt-1">{stats?.activeUsers ?? 0} currently online</p>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                  <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-[11px] font-bold uppercase">Chats & Groups</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.totalConversations ?? '...'}</p>
                  <p className="text-[11px] text-indigo-600/80 mt-1">Active channels</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
                    <Activity className="w-5 h-5" />
                    <span className="text-[11px] font-bold uppercase">Messages Sent</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.totalMessages ?? '...'}</p>
                  <p className="text-[11px] text-emerald-600/80 mt-1">Delivered via WebSockets</p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
                    <HardDrive className="w-5 h-5" />
                    <span className="text-[11px] font-bold uppercase">Media Storage</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.totalAttachments ?? 0}</p>
                  <p className="text-[11px] text-amber-600/80 mt-1">Audio recordings & files</p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                  <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-[11px] font-bold uppercase">Pending Reports</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.pendingReports ?? 0}</p>
                  <p className="text-[11px] text-rose-600/80 mt-1">Awaiting moderation</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">System Health</h4>
                <p>Node.js real-time engine running with WebSocket heartbeat ping/pong every 30s. Multi-device message broadcast active.</p>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Filter users by name, username, or email..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 font-semibold">User</th>
                      <th className="p-3 font-semibold">Email</th>
                      <th className="p-3 font-semibold">Role</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <p className="font-semibold text-slate-900 dark:text-white">{u.displayName}</p>
                          <p className="text-[11px] text-slate-400">@{u.username}</p>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.isSuspended ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500">Suspended</span>
                          ) : u.status === 'online' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500">Online</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500">Offline</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleToggleSuspend(u.id)}
                              className={`px-3 py-1 rounded-xl font-semibold transition ${
                                u.isSuspended
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-rose-500 text-white hover:bg-rose-600'
                              }`}
                            >
                              {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-3">
              {reportsList.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No reports submitted.</p>
              ) : (
                reportsList.map(r => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                          {r.targetType} Report
                        </span>
                        <span className="text-slate-400 text-[11px] font-medium">By {r.reporterName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : r.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-300 text-slate-600'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <p className="font-semibold text-rose-500">Reason: {r.reason}</p>
                      {r.details && <p className="text-slate-600 dark:text-slate-300 text-[11px]">"{r.details}"</p>}
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        Target: {r.targetPreview}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {r.targetType === 'message' && r.status === 'pending' && (
                        <button
                          onClick={() => handleDeleteReportedMessage(r.targetId, r.id)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Content</span>
                        </button>
                      )}
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleResolveReport(r.id, 'resolved')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Resolve</span>
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id, 'dismissed')}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition"
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
