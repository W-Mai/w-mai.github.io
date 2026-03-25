import { useState, useRef, useEffect, type FC } from 'react';
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  PRESET_COLORS,
  isValidHexColor,
  type StyleOverrides,
} from '../../../lib/editor/wechat-templates';

interface WechatSettingsPanelProps {
  overrides: StyleOverrides;
  onChange: (overrides: StyleOverrides) => void;
  onReset: () => void;
  templateBaseFontSize: number;
}

const WechatSettingsPanel: FC<WechatSettingsPanelProps> = ({
  overrides,
  onChange,
  onReset,
  templateBaseFontSize,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [hexInput, setHexInput] = useState(overrides.themeColor ?? '');
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Measure content height when expanded
  useEffect(() => {
    if (expanded && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, overrides]);

  const selectedFontId = FONT_FAMILY_OPTIONS.find(
    (o) => o.value === overrides.fontFamily,
  )?.id;

  const selectedFontSize =
    overrides.fontSizeRatio != null
      ? Math.round(overrides.fontSizeRatio * templateBaseFontSize)
      : undefined;

  const handleFontFamily = (opt: (typeof FONT_FAMILY_OPTIONS)[number]) => {
    if (selectedFontId === opt.id) {
      onChange({ ...overrides, fontFamily: undefined });
    } else {
      onChange({ ...overrides, fontFamily: opt.value });
    }
  };

  const handleFontSize = (size: number) => {
    if (selectedFontSize === size) {
      onChange({ ...overrides, fontSizeRatio: undefined });
    } else {
      onChange({ ...overrides, fontSizeRatio: size / templateBaseFontSize });
    }
  };

  const handleColorSelect = (color: string) => {
    if (overrides.themeColor === color) {
      onChange({ ...overrides, themeColor: undefined });
      setHexInput('');
    } else {
      onChange({ ...overrides, themeColor: color });
      setHexInput(color);
    }
  };

  const handleHexChange = (value: string) => {
    setHexInput(value);
    if (isValidHexColor(value)) {
      onChange({ ...overrides, themeColor: value });
    }
  };

  const handleIndentToggle = (enabled: boolean) => {
    onChange({ ...overrides, textIndent: enabled || undefined });
  };

  return (
    <div style={{ marginBottom: 'var(--editor-spacing-lg, 0.75rem)' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="editor-btn-pill"
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span>自定义设置</span>
      </button>

      {/* Collapsible panel with height animation */}
      <div style={{
        maxHeight: expanded ? `${contentHeight + 8}px` : '0px',
        overflow: 'hidden',
        transition: 'max-height 200ms ease',
      }}>
        <div ref={contentRef} className="editor-settings-body">
          {/* Font family */}
          <div>
            <div className="editor-settings-label">字体</div>
            <div className="editor-settings-row">
              {FONT_FAMILY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleFontFamily(opt)}
                  className={`editor-option-chip${selectedFontId === opt.id ? ' active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <div className="editor-settings-label">字号</div>
            <div className="editor-settings-row">
              {FONT_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => handleFontSize(size)}
                  className={`editor-option-chip${selectedFontSize === size ? ' active' : ''}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Theme color */}
          <div>
            <div className="editor-settings-label">主题色</div>
            <div className="editor-settings-row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleColorSelect(c.value)}
                  title={c.label}
                  className={`editor-color-swatch${overrides.themeColor === c.value ? ' active' : ''}`}
                  style={{ background: c.value }}
                  aria-label={c.label}
                />
              ))}
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#hex"
                className="editor-hex-input"
              />
            </div>
          </div>

          {/* Text indent */}
          <div>
            <div className="editor-settings-label">段落缩进</div>
            <div className="editor-settings-row">
              {([
                { label: '关闭', value: false },
                { label: '开启', value: true },
              ] as const).map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => handleIndentToggle(opt.value)}
                  className={`editor-option-chip${(overrides.textIndent ?? false) === opt.value ? ' active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setHexInput(''); onReset(); }}
              className="editor-btn-sm"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WechatSettingsPanel;
