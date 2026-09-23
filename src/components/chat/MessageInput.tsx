import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Trash2,
  X,
  Image,
  File,
  Loader2,
  Check
} from 'lucide-react';
import { Message, ConversationMember } from '../../types/index.ts';
import { useAudioRecorder } from '../../hooks/useAudioRecorder.ts';

interface MessageInputProps {
  conversationId: string;
  members: ConversationMember[];
  replyingTo: Message | null;
  editingMessage: Message | null;
  onSendMessage: (data: {
    text: string;
    type?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file';
    replyToId?: string;
    attachment?: any;
  }) => Promise<void>;
  onEditMessage: (messageId: string, newText: string) => Promise<void>;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onTyping: (isTyping: boolean) => void;
  onRecording: (isRecording: boolean) => void;
  token: string | null;
}

const EMOJI_CATEGORIES = [
  { name: 'Smileys', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😎', '🥳', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕'] },
  { name: 'Gestures', emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '💪', '🙏', '👏', '🙌', '👐', '🤲'] },
  { name: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'] },
  { name: 'Objects', emojis: ['🔥', '✨', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '💡', '📌', '🚀', '⭐', '🌟', '⚡', '☕', '🍕', '🍻', '💼', '💻', '📱', '📷', '🎧', '🎮', '⚽', '🏀'] }
];

export const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  members,
  replyingTo,
  editingMessage,
  onSendMessage,
  onEditMessage,
  onCancelReply,
  onCancelEdit,
  onTyping,
  onRecording,
  token
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionFilter, setMentionFilter] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isRecording,
    duration,
    waveformLevels,
    error: micError,
    startRecording,
    stopRecording,
    cancelRecording
  } = useAudioRecorder();

  // Populate input when editing
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [editingMessage]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Handle typing debounce
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Check for @mention trigger
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
      const q = textBeforeCursor.slice(lastAtIdx + 1);
      if (!/\s/.test(q)) {
        setMentionQuery(q);
        setMentionFilter(q.toLowerCase());
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }

    // Dispatch typing indicator
    onTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleSelectMention = (username: string) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBeforeCursor = text.slice(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    const newText = text.slice(0, lastAtIdx) + `@${username} ` + text.slice(cursor);
    setText(newText);
    setMentionQuery(null);
    textareaRef.current.focus();
  };

  const handleSend = async () => {
    if (isRecording) {
      handleSendVoice();
      return;
    }

    if (editingMessage) {
      if (!text.trim()) return;
      await onEditMessage(editingMessage.id, text.trim());
      setText('');
      onCancelEdit();
      return;
    }

    if (!text.trim()) return;

    const trimmed = text.trim();
    setText('');
    onTyping(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage({
      text: trimmed,
      type: 'text',
      replyToId: replyingTo?.id
    });

    if (replyingTo) onCancelReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Upload file helper
  const uploadFile = async (file: File): Promise<any> => {
    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'File upload failed');
      return data;
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'media' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploaded = await uploadFile(file);
      let msgType: 'image' | 'video' | 'audio' | 'file' = 'file';

      if (file.type.startsWith('image/')) msgType = 'image';
      else if (file.type.startsWith('video/')) msgType = 'video';
      else if (file.type.startsWith('audio/')) msgType = 'audio';

      await onSendMessage({
        text: text.trim(),
        type: msgType,
        replyToId: replyingTo?.id,
        attachment: uploaded
      });

      setText('');
      if (replyingTo) onCancelReply();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      e.target.value = '';
      setShowAttachMenu(false);
    }
  };

  // Voice recording handlers
  const handleStartRecording = async () => {
    const ok = await startRecording();
    if (ok) {
      onRecording(true);
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
    onRecording(false);
  };

  const handleSendVoice = async () => {
    onRecording(false);
    const result = await stopRecording();
    if (!result) return;

    setIsUploading(true);
    setUploadProgress('Uploading voice message...');

    try {
      const formData = new FormData();
      formData.append('file', result.blob, `voice-${Date.now()}.webm`);
      formData.append('durationSeconds', result.durationSeconds.toString());

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload voice message');

      await onSendMessage({
        text: '',
        type: 'voice',
        replyToId: replyingTo?.id,
        attachment: data
      });

      if (replyingTo) onCancelReply();
    } catch (err: any) {
      alert(err.message || 'Failed to send voice message');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const formatRecordTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const filteredMembers = members.filter(m =>
    m.user &&
    (m.user.username.toLowerCase().includes(mentionFilter) ||
     m.user.displayName.toLowerCase().includes(mentionFilter))
  );

  return (
    <div className="relative border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 md:px-4 py-2 select-none">
      {/* Uploading overlay */}
      {isUploading && (
        <div className="absolute inset-x-0 -top-10 bg-sky-600 text-white text-xs py-1.5 px-4 flex items-center justify-center gap-2 shadow-md animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{uploadProgress || 'Uploading...'}</span>
        </div>
      )}

      {/* Mic Error Banner */}
      {micError && (
        <div className="mb-2 p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-500 text-xs rounded-xl border border-rose-200 dark:border-rose-900 flex items-center justify-between">
          <span>{micError}</span>
          <button onClick={() => {}} className="p-1 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reply Preview Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl border-l-4 border-sky-500 text-xs text-slate-700 dark:text-slate-300">
          <div className="min-w-0 pr-2">
            <span className="font-bold text-sky-500 block truncate">Replying to {replyingTo.senderName}</span>
            <span className="text-[11px] text-slate-500 line-clamp-1">
              {replyingTo.type === 'voice' ? '🎤 Voice message' : replyingTo.text}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Preview Banner */}
      {editingMessage && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl border-l-4 border-amber-500 text-xs text-slate-700 dark:text-slate-300">
          <div className="min-w-0 pr-2">
            <span className="font-bold text-amber-500 block truncate">Editing Message</span>
            <span className="text-[11px] text-slate-500 line-clamp-1">{editingMessage.text}</span>
          </div>
          <button
            onClick={onCancelEdit}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mention Autocomplete List */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden z-30 max-h-48 overflow-y-auto">
          {filteredMembers.map(m => (
            <button
              key={m.userId}
              onClick={() => handleSelectMention(m.user!.username)}
              className="w-full px-3 py-2 text-left hover:bg-sky-50 dark:hover:bg-slate-700 flex items-center gap-2 text-xs transition"
            >
              <img src={m.user?.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white truncate">{m.user?.displayName}</p>
                <p className="text-[10px] text-slate-400">@{m.user?.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Emoji Picker Menu */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3 z-30 max-h-72 overflow-y-auto">
          {EMOJI_CATEGORIES.map(cat => (
            <div key={cat.name} className="mb-3">
              <h5 className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">{cat.name}</h5>
              <div className="grid grid-cols-8 gap-1">
                {cat.emojis.map(e => (
                  <button
                    key={e}
                    onClick={() => {
                      setText(prev => prev + e);
                      setShowEmojiPicker(false);
                    }}
                    className="hover:scale-125 transition p-1 text-base text-center"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachMenu && (
        <div className="absolute bottom-full left-12 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 z-30 space-y-1">
          <button
            onClick={() => mediaInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Image className="w-4 h-4" />
            </div>
            <span>Photos & Videos</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <File className="w-4 h-4" />
            </div>
            <span>File or Document</span>
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={e => handleFileSelected(e, 'media')}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        onChange={e => handleFileSelected(e, 'document')}
        className="hidden"
      />

      {/* Voice Recording Mode UI */}
      {isRecording ? (
        <div className="flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl px-4 py-2.5">
          {/* Pulsing indicator and timer */}
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-pulse shrink-0" />
            <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
              {formatRecordTime(duration)}
            </span>
          </div>

          {/* Real-time live audio waveform bars */}
          <div className="flex-1 flex items-center justify-center gap-[3px] h-6 px-4">
            {waveformLevels.map((lvl, idx) => (
              <div
                key={idx}
                style={{ height: `${lvl}%` }}
                className="w-1 bg-rose-500 rounded-full transition-all duration-75"
              />
            ))}
          </div>

          {/* Cancel and Send Voice buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCancelRecording}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
              title="Discard recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleSendVoice}
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1 transition shadow-sm"
              title="Send voice note"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </div>
      ) : (
        /* Regular Typing Mode UI */
        <div className="flex items-end gap-1.5 md:gap-2">
          {/* Attachment button */}
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            title="Attach file or photo"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Input container */}
          <div className="flex-1 flex items-end gap-1.5 bg-slate-100 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 rounded-2xl px-3 py-1.5 focus-within:border-sky-500 transition">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Write a message... (Enter to send)"
              className="flex-1 bg-transparent border-0 resize-none text-xs md:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none max-h-32 py-1 leading-relaxed"
            />

            {/* Emoji toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 text-slate-400 hover:text-sky-500 rounded-lg shrink-0 transition"
              title="Add Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {/* Send button (if text present or editing) or Voice recording button (if empty) */}
          {text.trim() || editingMessage ? (
            <button
              type="button"
              onClick={handleSend}
              className="p-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20 transition shrink-0 flex items-center justify-center"
              title={editingMessage ? 'Save Edit' : 'Send Message'}
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartRecording}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-500 hover:text-white text-slate-500 dark:text-slate-300 transition shrink-0 flex items-center justify-center"
              title="Record voice message"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
