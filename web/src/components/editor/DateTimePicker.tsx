import { type FC, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Parse "YYYY/MM/DD" or "YYYY/MM/DD HH:mm" into parts */
function parseDateStr(s: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  return {
    year: parseInt(m[1], 10),
    month: parseInt(m[2], 10),
    day: parseInt(m[3], 10),
    hour: m[4] != null ? parseInt(m[4], 10) : 0,
    minute: m[5] != null ? parseInt(m[5], 10) : 0,
  };
}

/** Format parts back to "YYYY/MM/DD HH:mm" */
function formatDate(y: number, mo: number, d: number, h: number, mi: number): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(y, 4)}/${pad(mo)}/${pad(d)} ${pad(h)}:${pad(mi)}`;
}

/** Get days in a month */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Get day of week for the 1st of a month (0=Sun) */
function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Neumorphism-styled calendar + time picker */
const DateTimePicker: FC<DateTimePickerProps> = ({ value, onChange, placeholder = 'YYYY/MM/DD HH:mm' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseDateStr(value), [value]);
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1);
  const [hour, setHour] = useState(parsed?.hour ?? now.getHours());
  const [minute, setMinute] = useState(parsed?.minute ?? now.getMinutes());

  // Sync view when value changes externally
  useEffect(() => {
    const p = parseDateStr(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
      setHour(p.hour);
      setMinute(p.minute);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectDay = useCallback((day: number) => {
    onChange(formatDate(viewYear, viewMonth, day, hour, minute));
  }, [viewYear, viewMonth, hour, minute, onChange]);

  const changeTime = useCallback((h: number, m: number) => {
    setHour(h);
    setMinute(m);
    if (parsed) {
      onChange(formatDate(parsed.year, parsed.month, parsed.day, h, m));
    }
  }, [parsed, onChange]);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const days = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfWeek(viewYear, viewMonth);

  const navBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    fontSize: T.fontSizeSm,
    color: T.colorTextSecondary,
    borderRadius: T.radiusSm,
    transition: `background ${T.transitionFast}`,
  };

  const cellBase: React.CSSProperties = {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: T.fontSizeXs,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: `all ${T.transitionFast}`,
    padding: 0,
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: `${T.spacingXs} ${T.spacingSm}`,
          background: T.colorBg,
          border: `1px solid ${T.colorBorderLight}`,
          borderRadius: T.radiusSm,
          fontSize: T.fontSizeSm,
          fontFamily: T.fontSans,
          color: value ? T.colorText : T.colorTextMuted,
          boxShadow: T.shadowInset,
          outline: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: `border-color ${T.transitionFast}`,
        }}
      >
        {value || placeholder}
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 200,
          marginTop: '4px',
          background: T.colorBg,
          border: `1px solid ${T.colorBorder}`,
          borderRadius: T.radiusMd,
          boxShadow: T.shadowRaised,
          padding: '10px',
          width: '240px',
          fontFamily: T.fontSans,
        }}>
          {/* Month/Year nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <button type="button" onClick={prevMonth} style={navBtnStyle}>‹</button>
            <span style={{ fontSize: T.fontSizeSm, fontWeight: 600, color: T.colorText }}>
              {MONTHS[viewMonth - 1]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} style={navBtnStyle}>›</button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{
                textAlign: 'center',
                fontSize: T.fontSizeXs,
                color: T.colorTextMuted,
                fontWeight: 600,
                padding: '2px 0',
              }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {/* Empty cells before first day */}
            {Array.from({ length: startDay }, (_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const d = i + 1;
              const isSelected = parsed?.year === viewYear && parsed?.month === viewMonth && parsed?.day === d;
              const isToday = d === now.getDate() && viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear();
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => selectDay(d)}
                  style={{
                    ...cellBase,
                    background: isSelected ? T.colorAccent : 'transparent',
                    color: isSelected ? T.colorBg : isToday ? T.colorAccent : T.colorText,
                    fontWeight: isToday || isSelected ? 700 : 400,
                    boxShadow: isSelected ? T.shadowBtn : 'none',
                  }}
                >{d}</button>
              );
            })}
          </div>

          {/* Time picker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: `1px solid ${T.colorBorderLight}`,
          }}>
            <span style={{ fontSize: T.fontSizeXs, color: T.colorTextSecondary, fontWeight: 600 }}>Time</span>
            <input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => changeTime(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)), minute)}
              style={{
                width: '40px',
                padding: '2px 4px',
                background: T.colorBg,
                border: `1px solid ${T.colorBorderLight}`,
                borderRadius: T.radiusSm,
                fontSize: T.fontSizeSm,
                fontFamily: T.fontMono,
                color: T.colorText,
                boxShadow: T.shadowInset,
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: T.fontSizeSm, color: T.colorTextMuted, fontWeight: 600 }}>:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(e) => changeTime(hour, Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              style={{
                width: '40px',
                padding: '2px 4px',
                background: T.colorBg,
                border: `1px solid ${T.colorBorderLight}`,
                borderRadius: T.radiusSm,
                fontSize: T.fontSizeSm,
                fontFamily: T.fontMono,
                color: T.colorText,
                boxShadow: T.shadowInset,
                textAlign: 'center',
                outline: 'none',
              }}
            />
            {/* Now button */}
            <button
              type="button"
              onClick={() => {
                const n = new Date();
                setViewYear(n.getFullYear());
                setViewMonth(n.getMonth() + 1);
                setHour(n.getHours());
                setMinute(n.getMinutes());
                onChange(formatDate(n.getFullYear(), n.getMonth() + 1, n.getDate(), n.getHours(), n.getMinutes()));
              }}
              style={{
                marginLeft: 'auto',
                padding: '2px 8px',
                background: T.colorBg,
                border: `1px solid ${T.colorBorderLight}`,
                borderRadius: T.radiusSm,
                fontSize: T.fontSizeXs,
                color: T.colorTextSecondary,
                cursor: 'pointer',
                boxShadow: T.shadowBtn,
                transition: `all ${T.transitionFast}`,
              }}
            >Now</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
