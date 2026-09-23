import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Reply,
  Share2,
  Edit2,
  Trash2,
  AlertTriangle,
  Copy,
  FileText,
  Download,
  Smile,
  MoreVertical
} from 'lucide-react';
import { Message } from '../../types/index.ts';
import { AudioMessagePlayer } from '../AudioMessagePlayer.tsx';

interface MessageItemProps {
  message: Message;
  isMe: boolean;
  isGroup: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onToggleSelect?: (messageId: string) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onForward: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onReport: (messageId: string, text: string) => void;
  onOpenMedia: (url: string, type: 'image' | 'video', fileName?: string) => void;
  onScrollToMessage?: (messageId: string) => void;
}

const POPULAR_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '👏', '😮', '😢'];

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isMe,
  isGroup,
  isSelected = false,
  isSelectionMode = false,
  onToggleSelect,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onReact,
  onReport,
  onOpenMedia,
  onScrollToMessage
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowActions(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Sender name color for group chats
  const getSenderColor = (name: string) => {
    const colors = [
      'text-pink-500 dark:text-pink-400',
      'text-indigo-500 dark:text-indigo-400',
      'text-emerald-500 dark:text-emerald-400',
      'text-amber-500 dark:text-amber-400',
      'text-cyan-500 dark:text-cyan-400',
      'text-purple-500 dark:text-purple-400'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex items-end gap-2 px-3 md:px-4 py-1.5 transition select-none ${
        isMe ? 'flex-row-reverse' : 'flex-row'
      } ${isSelected ? 'bg-sky-500/10' : 'hover:bg-slate-500/5'}`}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmojiPicker(false);
      }}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <button
          onClick={() => onToggleSelect?.(message.id)}
          className={`self-center w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
            isSelected
              ? 'bg-sky-500 border-sky-500 text-white'
              : 'border-slate-300 dark:border-slate-600'
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Other user's avatar in group */}
      {isGroup && !isMe && (
        <img
          src={message.senderAvatar}
          alt={message.senderName}
          className="w-8 h-8 rounded-full object-cover shrink-0 mb-1"
        />
      )}

      {/* Bubble Container */}
      <div className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[60%] flex flex-col ${
        isMe ? 'items-end' : 'items-start'
      }`}>
        {/* Floating Quick Action Toolbar on hover */}
        <div
          className={`absolute -top-7 z-20 hidden group-hover:flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg px-1.5 py-0.5 text-slate-500 dark:text-slate-400 ${
            isMe ? 'right-0' : 'left-0'
          }`}
        >
          {/* Quick Reaction Emojis */}
          {POPULAR_EMOJIS.slice(0, 4).map(emoji => (
            <button
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              className="hover:scale-125 transition px-1 py-0.5 text-xs"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
            title="More reactions"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onReply(message)}
            className="p-1 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onForward(message.id)}
            className="p-1 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
            title="Forward"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
            title="More options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Emoji picker dropdown */}
        {showEmojiPicker && (
          <div
            className={`absolute -top-16 z-30 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 ${
              isMe ? 'right-0' : 'left-0'
            }`}
          >
            {POPULAR_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(message.id, emoji);
                  setShowEmojiPicker(false);
                }}
                className="hover:scale-125 transition p-1 text-sm"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Actions Dropdown Menu */}
        {showActions && (
          <div
            className={`absolute top-2 z-30 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl py-1 text-xs text-slate-700 dark:text-slate-200 ${
              isMe ? 'right-0' : 'left-0'
            }`}
          >
            <button
              onClick={handleCopyText}
              className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
            <button
              onClick={() => {
                onToggleSelect?.(message.id);
                setShowActions(false);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select</span>
            </button>
            {isMe && (
              <button
                onClick={() => {
                  onEdit(message);
                  setShowActions(false);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={() => {
                onDelete(message.id);
                setShowActions(false);
              }}
              className="w-full px-3 py-1.5 text-left text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
            {!isMe && (
              <button
                onClick={() => {
                  onReport(message.id, message.text);
                  setShowActions(false);
                }}
                className="w-full px-3 py-1.5 text-left text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Report</span>
              </button>
            )}
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-3.5 py-2 shadow-sm transition-all ${
            isMe
              ? 'bg-sky-500 text-white rounded-br-xs'
              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
          }`}
        >
          {/* Sender name if group and not me */}
          {isGroup && !isMe && (
            <p className={`text-[11px] font-bold mb-1 ${getSenderColor(message.senderName)}`}>
              {message.senderName}
            </p>
          )}

          {/* Forwarded Header */}
          {message.forwardedFrom && (
            <div className={`flex items-center gap-1 text-[10px] font-medium mb-1.5 opacity-80 ${
              isMe ? 'text-white/90' : 'text-slate-500'
            }`}>
              <Share2 className="w-3 h-3" />
              <span>Forwarded from {message.forwardedFrom}</span>
            </div>
          )}

          {/* Replied Message Quote */}
          {message.replyTo && (
            <div
              onClick={() => onScrollToMessage?.(message.replyTo!.id)}
              className={`mb-2 p-2 rounded-xl text-xs cursor-pointer border-l-3 transition ${
                isMe
                  ? 'bg-sky-600/60 border-white text-white/95 hover:bg-sky-600/80'
                  : 'bg-slate-100 dark:bg-slate-750 border-sky-500 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <p className="font-bold text-[10px] opacity-90">{message.replyTo.senderName}</p>
              <p className="line-clamp-1 text-[11px] opacity-80">
                {message.replyTo.type === 'voice' ? '🎤 Voice message' : message.replyTo.type === 'image' ? '📷 Photo' : message.replyTo.text}
              </p>
            </div>
          )}

          {/* Photo Attachment */}
          {message.type === 'image' && message.attachment && (
            <div className="mb-1.5 cursor-pointer overflow-hidden rounded-xl group/media">
              <img
                src={message.attachment.fileUrl}
                alt={message.attachment.fileName}
                onClick={() => onOpenMedia(message.attachment!.fileUrl, 'image', message.attachment!.fileName)}
                className="max-h-72 w-full object-cover rounded-xl transition duration-200 group-hover/media:scale-102"
              />
            </div>
          )}

          {/* Video Attachment */}
          {message.type === 'video' && message.attachment && (
            <div className="mb-1.5 rounded-xl overflow-hidden max-w-sm">
              <video
                src={message.attachment.fileUrl}
                controls
                className="max-h-72 w-full rounded-xl bg-black"
              />
            </div>
          )}

          {/* Voice Message */}
          {message.type === 'voice' && message.attachment && (
            <AudioMessagePlayer
              src={message.attachment.fileUrl}
              durationSeconds={message.attachment.durationSeconds}
              isSender={isMe}
            />
          )}

          {/* Audio File */}
          {message.type === 'audio' && message.attachment && (
            <div className="mb-1 w-full min-w-[220px]">
              <p className="text-xs font-semibold mb-1 truncate">{message.attachment.fileName}</p>
              <AudioMessagePlayer
                src={message.attachment.fileUrl}
                durationSeconds={message.attachment.durationSeconds}
                isSender={isMe}
              />
            </div>
          )}

          {/* Document / Generic File */}
          {message.type === 'file' && message.attachment && (
            <a
              href={`${message.attachment.fileUrl}?download=1`}
              download={message.attachment.fileName}
              className={`flex items-center gap-3 p-2.5 rounded-xl mb-1 transition ${
                isMe
                  ? 'bg-sky-600/50 hover:bg-sky-600/70 text-white'
                  : 'bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 text-slate-800 dark:text-slate-100'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                isMe ? 'bg-white/20' : 'bg-sky-500/10 text-sky-500'
              }`}>
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{message.attachment.fileName}</p>
                <p className="text-[10px] opacity-75">{formatFileSize(message.attachment.fileSize)}</p>
              </div>
              <Download className="w-4 h-4 shrink-0 opacity-75" />
            </a>
          )}

          {/* Message Text (if present) */}
          {message.text && (
            <p className="text-xs md:text-sm whitespace-pre-wrap break-words leading-relaxed font-normal">
              {message.text}
            </p>
          )}

          {/* Footer: timestamp, edited tag, status checkmarks */}
          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-mono select-none ${
            isMe ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
          }`}>
            {message.isEdited && <span className="italic opacity-80">edited</span>}
            <span>{formatTime(message.createdAt)}</span>
            {isMe && (
              <span className="inline-flex">
                <CheckCheck className="w-3.5 h-3.5 text-white" />
              </span>
            )}
          </div>
        </div>

        {/* Emoji Reactions Bar */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 z-10">
            {Object.entries(message.reactions).map(([emoji, userIds]) => {
              if (userIds.length === 0) return null;
              const hasReacted = userIds.includes(message.senderId);

              return (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition ${
                    hasReacted
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-600 dark:text-sky-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px]">{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
