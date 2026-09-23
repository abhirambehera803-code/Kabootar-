import React from 'react';
import { X, Download, ZoomIn } from 'lucide-react';

interface MediaLightboxModalProps {
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  fileName?: string;
  onClose: () => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  mediaUrl,
  mediaType,
  fileName,
  onClose
}) => {
  if (!mediaUrl) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = `${mediaUrl}?download=1`;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 select-none"
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={handleDownload}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition backdrop-blur-sm"
          title="Download file"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div onClick={e => e.stopPropagation()} className="max-w-5xl max-h-[85vh] flex items-center justify-center">
        {mediaType === 'image' ? (
          <img
            src={mediaUrl}
            alt={fileName || 'Preview'}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
        ) : (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};
