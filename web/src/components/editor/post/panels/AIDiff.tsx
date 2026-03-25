import type { FC } from 'react';
import { EDITOR_TOKENS as T } from '../../shared/editor-tokens';

interface AIDiffPanelProps {
  originalText: string;
  suggestedText: string;
  isStreaming: boolean;
  position: { top: number; left: number };
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}

const AIDiffPanel: FC<AIDiffPanelProps> = ({
  originalText, suggestedText, isStreaming, position, onAccept, onReject, onCancel,
}) => {
  return (
    <div style={{
      position: 'absolute', top: position.top, left: position.left,
      background: T.colorBg, border: `1px solid ${T.colorBorder}`,
      borderRadius: T.radiusMd, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      width: '400px', maxHeight: '300px', zIndex: 1500,
      fontFamily: T.fontSans, fontSize: T.fontSizeSm,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Diff content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{
          flex: 1, padding: T.spacingMd,
          background: '#fef2f2', borderRight: `1px solid ${T.colorBorderLight}`,
          fontSize: T.fontSizeXs, fontFamily: T.fontMono,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          color: T.colorError, maxHeight: '200px', overflow: 'auto',
        }}>
          {originalText}
        </div>
        <div style={{
          flex: 1, padding: T.spacingMd,
          background: '#f0fdf4',
          fontSize: T.fontSizeXs, fontFamily: T.fontMono,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          color: '#166534', maxHeight: '200px', overflow: 'auto',
        }}>
          {suggestedText}
          {isStreaming && <span style={{ opacity: 0.5 }}>▊</span>}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: T.spacingSm,
        padding: T.spacingSm, borderTop: `1px solid ${T.colorBorderLight}`,
      }}>
        {isStreaming ? (
          <button onClick={onCancel} style={btnStyle(T.colorTextSecondary, T.colorBorder)}>
            Cancel
          </button>
        ) : (
          <>
            <button onClick={onReject} style={btnStyle(T.colorTextSecondary, T.colorBorder)}>
              Reject
            </button>
            <button onClick={onAccept} style={btnStyle(T.colorBg, T.colorAccent, true)}>
              Accept
            </button>
          </>
        )}
      </div>
    </div>
  );
};

function btnStyle(color: string, border: string, filled = false): React.CSSProperties {
  return {
    padding: `2px ${T.spacingSm}`,
    background: filled ? border : 'none',
    color,
    border: filled ? 'none' : `1px solid ${border}`,
    borderRadius: T.radiusSm, fontSize: T.fontSizeXs,
    cursor: 'pointer', fontWeight: 500,
  };
}

const EDITOR_TOKENS_SPACING_SM = '0.375rem';

export default AIDiffPanel;
