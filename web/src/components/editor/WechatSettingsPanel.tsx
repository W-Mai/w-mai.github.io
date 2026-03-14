import { useState, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  PRESET_COLORS,
  isValidHexColor,
  type StyleOverrides,
} from '../../lib/wechat-templates';

interface WechatSettingsPanelProps {
  overrides: StyleOverrides;
  onChange: (overrides: StyleOverrides) => void;
  onReset: () => void;
  templateBaseFontSize: number;
}

// Shared style for selected state (inset + gradient)
const selectedStyle = {
  fontWeight: 600 as const,
  boxShadow: T.shadowInset,
  background: 'linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light))',
};

// Shared style for unselected buttons (transparent, no shadow)
const unselectedStyle = {
  fontWeight: 400 as const,
  boxShadow: 'none' as const,
  background: 'transparent',
};

// Small group label style
const labelStyle = {
  fontSize: T.fontSizeXs,
  color: T.colorTextMuted,
  marginBottom: T.spacingXs,
  userSelect: 'none' as const,
};

const WechatSettingsPanel: FC<WechatSettingsPanelProps> = ({
  overrides,
  onChange,
  onReset,
  templateBaseFontSize,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [hexInput, setHexInput] = useState(overrides.themeColor ?? '');

  // Derive selected font family ID from overrides
  const selectedFontId = FONT_FAMILY_OPTIONS.find(
    (o) => o.value === overrides.fontFamily,
  )?.id;

  // Derive selected font size from ratio
  const selectedFontSize =
    overrides.fontSizeRatio != null
      ? Math.round(overrides.fontSizeRatio * templateBaseFontSize)
      : undefined;

  const handleFontFamily = (opt: (typeof FONT_FAMILY_OPTIONS)[number]) => {
    // Deselect if already selected
    if (selectedFontId === opt.id) {
      onChange({ ...overrides, fontFamily: undefined });
    } else {
      onChange({ ...overrides, fontFamily: opt.value });
    }
  };

  const handleFontSize = (size: number) => {
    // Deselect if already selected
    if (selectedFontSize === size) {
      onChange({ ...overrides, fontSizeRatio: undefined });
    } else {
      onChange({ ...overrides, fontSizeRatio: size / templateBaseFontSize });
    }
  };

  const handleColorSelect = (color: string) => {
    // Deselect if already selected
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
    <div style={{ marginBottom: T.spacingLg }}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="editor-btn"
        style={{
          width: '100%',
          padding: `${T.spacingSm} ${T.spacingMd}`,
          border: 'none',
          borderRadius: T.radiusSm,
          fontSize: T.fontSizeSm,
          color: T.colorTextSecondary,
          background: T.colorBg,
          cursor: 'pointer',
          boxShadow: T.shadowBtn,
          transition: `all ${T.transitionFast}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: T.spacingSm,
        }}
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span>自定义设置</span>
      </button>

      {/* Collapsible panel */}
      {expanded && (
        <div
          style={{
            marginTop: T.spacingSm,
            padding: T.spacingMd,
            borderRadius: T.radiusMd,
            boxShadow: T.shadowInset,
            display: 'flex',
            flexDirection: 'column',
            gap: T.spacingMd,
          }}
        >
          {/* Font family */}
          <div>
            <div style={labelStyle}>字体</div>
            <div style={{ display: 'flex', gap: T.spacingSm }}>
              {FONT_FAMILY_OPTIONS.map((opt) => {
                const isSelected = selectedFontId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleFontFamily(opt)}
                    className={!isSelected ? 'editor-btn' : ''}
                    style={{
                      flex: 1,
                      padding: `${T.spacingXs} ${T.spacingSm}`,
                      border: 'none',
                      borderRadius: T.radiusSm,
                      fontSize: T.fontSizeXs,
                      cursor: 'pointer',
                      color: isSelected ? T.colorText : T.colorTextSecondary,
                      transition: `all ${T.transitionFast}`,
                      ...(isSelected ? selectedStyle : unselectedStyle),
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font size */}
          <div>
            <div style={labelStyle}>字号</div>
            <div style={{ display: 'flex', gap: T.spacingSm }}>
              {FONT_SIZE_OPTIONS.map((size) => {
                const isSelected = selectedFontSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => handleFontSize(size)}
                    className={!isSelected ? 'editor-btn' : ''}
                    style={{
                      flex: 1,
                      padding: `${T.spacingXs} ${T.spacingSm}`,
                      border: 'none',
                      borderRadius: T.radiusSm,
                      fontSize: T.fontSizeXs,
                      cursor: 'pointer',
                      color: isSelected ? T.colorText : T.colorTextSecondary,
                      transition: `all ${T.transitionFast}`,
                      ...(isSelected ? selectedStyle : unselectedStyle),
                    }}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme color */}
          <div>
            <div style={labelStyle}>主题色</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: T.spacingSm, alignItems: 'center' }}>
              {PRESET_COLORS.map((c) => {
                const isSelected = overrides.themeColor === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => handleColorSelect(c.value)}
                    title={c.label}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: isSelected
                        ? `2px solid ${T.colorText}`
                        : '2px solid transparent',
                      background: c.value,
                      cursor: 'pointer',
                      padding: 0,
                      transition: `border-color ${T.transitionFast}`,
                      flexShrink: 0,
                    }}
                    aria-label={c.label}
                  />
                );
              })}
              {/* Hex input */}
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#hex"
                style={{
                  width: '72px',
                  padding: `${T.spacingXs} ${T.spacingSm}`,
                  border: 'none',
                  borderRadius: T.radiusSm,
                  fontSize: T.fontSizeXs,
                  color: T.colorText,
                  background: T.colorBg,
                  boxShadow: T.shadowInset,
                  outline: 'none',
                  fontFamily: T.fontMono,
                }}
              />
            </div>
          </div>

          {/* Text indent */}
          <div>
            <div style={labelStyle}>段落缩进</div>
            <div style={{ display: 'flex', gap: T.spacingSm }}>
              {([
                { label: '关闭', value: false },
                { label: '开启', value: true },
              ] as const).map((opt) => {
                const isSelected = (overrides.textIndent ?? false) === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => handleIndentToggle(opt.value)}
                    className={!isSelected ? 'editor-btn' : ''}
                    style={{
                      flex: 1,
                      padding: `${T.spacingXs} ${T.spacingSm}`,
                      border: 'none',
                      borderRadius: T.radiusSm,
                      fontSize: T.fontSizeXs,
                      cursor: 'pointer',
                      color: isSelected ? T.colorText : T.colorTextSecondary,
                      transition: `all ${T.transitionFast}`,
                      ...(isSelected ? selectedStyle : unselectedStyle),
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setHexInput('');
                onReset();
              }}
              className="editor-btn"
              style={{
                padding: `${T.spacingXs} ${T.spacingLg}`,
                border: 'none',
                borderRadius: T.radiusSm,
                fontSize: T.fontSizeXs,
                color: T.colorTextSecondary,
                background: T.colorBg,
                cursor: 'pointer',
                boxShadow: T.shadowBtn,
                transition: `all ${T.transitionFast}`,
              }}
            >
              重置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WechatSettingsPanel;
