import React, { useState } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface ReportModalProps {
  isOpen: boolean;
  targetType: 'user' | 'message';
  targetId: string;
  targetName?: string;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  targetType,
  targetId,
  targetName,
  onClose
}) => {
  const { token } = useAuth();
  const [reason, setReason] = useState('Spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details
        })
      });

      if (!res.ok) throw new Error('Failed to submit report');

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error submitting report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Report {targetType}</h3>
              {targetName && <p className="text-[11px] text-slate-400">{targetName}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Report Submitted</h4>
            <p className="text-xs text-slate-400 max-w-xs">
              Thank you for keeping Aether safe. Our moderation team will review this promptly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-4 space-y-4">
            {error && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-500 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for report
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Spam">Spam or unwanted commercial content</option>
                <option value="Harassment">Harassment or cyberbullying</option>
                <option value="Hate Speech">Hate speech or discrimination</option>
                <option value="Inappropriate Content">Inappropriate, sexual, or violent content</option>
                <option value="Impersonation">Impersonation of another person</option>
                <option value="Other">Other violation of Community Guidelines</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Additional Details (Optional)
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Provide any relevant context..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
