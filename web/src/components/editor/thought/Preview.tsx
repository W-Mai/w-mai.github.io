import { useState, useEffect, type FC } from 'react';
import { createPortal } from 'react-dom';

interface ThoughtPreviewProps {
  content: string;
  tagInput: string;
  mood: string;
  previewHtml: string;
}

/** Portaled timeline preview card for the thought editor. */
const ThoughtPreview: FC<ThoughtPreviewProps> = ({ content, tagInput, mood, previewHtml }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById('thought-preview-slot'));
  }, []);

  if (!slot || !content.trim()) return null;

  const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);

  return createPortal(
    <div className="timeline-item timeline-preview-item">
      <div className="timeline-dot"></div>
      <div className="timeline-connector"></div>
      <div className="neu-card neu-preview-card relative rounded-[2rem] p-5 sm:p-6">
        <span className="neu-preview-badge">Preview</span>
        {tags.length > 0 && (
          <div className="neu-tags-capsule absolute top-[0.875rem] right-[0.875rem]">
            {tags.map(tag => (
              <span key={tag} className="neu-tag-chip">{tag}</span>
            ))}
          </div>
        )}
        <div className="flex items-center mb-3 gap-2">
          {mood ? (
            <div className="neu-mood-time">
              <span className="neu-mood-badge">{mood}</span>
              <span className="neu-time-pill">just now</span>
            </div>
          ) : (
            <span className="neu-time-pill">just now</span>
          )}
        </div>
        <div
          className="thought-content text-[var(--text-primary)] text-sm sm:text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>,
    slot,
  );
};

export default ThoughtPreview;
