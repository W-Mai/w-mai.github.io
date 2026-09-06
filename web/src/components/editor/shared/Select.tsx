import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface EditorSelectProps {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

const styles = `
  .editor-select { position: relative; min-width: 0; width: 100%; }
  .editor-select[data-open="true"] { z-index: 30; }
  .editor-select-trigger {
    display: flex; align-items: center; justify-content: space-between; gap: ${T.spacingSm};
    width: 100%; min-width: 0; min-height: 2.25rem; padding: ${T.spacingLg};
    box-sizing: border-box; border: none; border-radius: ${T.radiusMd};
    color: ${T.colorText}; background: ${T.colorBg}; box-shadow: ${T.shadowInset};
    font: inherit; text-align: left; cursor: pointer;
    transition: background ${T.transitionFast}, opacity ${T.transitionFast};
  }
  .editor-select .editor-select-trigger:focus,
  .editor-select .editor-select-trigger:focus-visible { outline: none; }
  .editor-select-trigger:hover:not(:disabled),
  .editor-select-trigger:focus-visible, .editor-select-trigger[aria-expanded="true"] {
    background: linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light));
    box-shadow: ${T.shadowInset};
  }
  .editor-select-trigger:disabled { opacity: 0.45; cursor: not-allowed; }
  .editor-select-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .editor-select-arrow { flex-shrink: 0; color: ${T.colorTextMuted}; }
  .editor-select-list {
    position: absolute; left: 0; right: 0; z-index: 1; margin: 0; padding: ${T.spacingSm};
    box-sizing: border-box; list-style: none; overflow-y: auto; overscroll-behavior: contain;
    border: none; border-radius: ${T.radiusLg}; background: ${T.colorBg}; box-shadow: ${T.shadowRaised};
  }
  .editor-select-option {
    display: flex; align-items: center; gap: ${T.spacingSm}; min-width: 0; box-sizing: border-box;
    min-height: 2.25rem; padding: ${T.spacingMd} ${T.spacingLg}; border-radius: ${T.radiusSm};
    color: ${T.colorText}; cursor: pointer; overflow-wrap: anywhere;
  }
  .editor-select-option[data-active="true"], .editor-select-option[aria-selected="true"] {
    background: linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light));
    box-shadow: ${T.shadowInset};
  }
  .editor-select-option[aria-selected="true"] { color: ${T.colorAccent}; font-weight: 600; }
  .editor-select-option-label { flex: 1; min-width: 0; }
  @media (prefers-reduced-motion: reduce) { .editor-select-trigger { transition: none; } }
`;

/** A themed single-select whose menu stays inside the current dialog and clipping bounds. */
export default function EditorSelect({ id, label, value, options, onChange, disabled = false }: EditorSelectProps) {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState(value);
  const [placement, setPlacement] = useState({ above: false, maxHeight: 288 });
  const unavailable = disabled || options.length === 0;
  const expanded = open && !unavailable;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const requestedIndex = options.findIndex((option) => option.value === activeValue);
  const activeIndex = requestedIndex >= 0 ? requestedIndex : Math.max(selectedIndex, 0);
  const menuId = id + '-options';
  const optionId = (index: number) => id + '-option-' + index;

  const measure = useCallback(() => {
    if (!trigger.current) return null;
    const rect = trigger.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    let top = viewport?.offsetTop ?? 0;
    let bottom = top + (viewport?.height ?? window.innerHeight);
    let ancestor = container.current?.parentElement;
    while (ancestor) {
      if (/auto|scroll|hidden|clip/.test(getComputedStyle(ancestor).overflowY)) {
        const bounds = ancestor.getBoundingClientRect();
        top = Math.max(top, bounds.top + ancestor.clientTop);
        bottom = Math.min(bottom, bounds.top + ancestor.clientTop + ancestor.clientHeight);
      }
      ancestor = ancestor.parentElement;
    }
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const gap = rem * 0.375;
    const availableBelow = Math.max(0, bottom - rect.bottom - gap);
    const availableAbove = Math.max(0, rect.top - top - gap);
    const desiredHeight = Math.min(rem * 18, options.length * rem * 2.25 + gap * 2);
    const above = availableBelow < desiredHeight && availableAbove > availableBelow;
    return {
      visible: bottom > top && rect.bottom > top && rect.top < bottom,
      placement: { above, maxHeight: Math.min(rem * 18, above ? availableAbove : availableBelow) },
    };
  }, [options.length]);

  useEffect(() => { setActiveValue(value); }, [value]);
  useEffect(() => { if (unavailable) setOpen(false); }, [unavailable]);

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      const measurement = measure();
      if (measurement?.visible) setPlacement(measurement.placement);
      else setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [expanded, measure]);

  useEffect(() => {
    if (!expanded) return;
    const item = menu.current?.children[activeIndex] as HTMLElement | undefined;
    const list = menu.current;
    if (!item || !list) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  }, [expanded, activeIndex]);

  const show = (index = Math.max(selectedIndex, 0)) => {
    if (unavailable || !trigger.current) return;
    const measurement = measure();
    if (!measurement) return;
    setPlacement(measurement.placement);
    setActiveValue(options[index].value);
    setOpen(true);
  };

  const choose = (index: number) => {
    if (unavailable || !options[index]) return;
    if (options[index].value !== value) onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (unavailable) return;
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape') {
      if (expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Enter' || event.key === ' ') {
      if (expanded) choose(activeIndex); else show();
    } else if (event.key === 'Home' || event.key === 'End') {
      const index = event.key === 'Home' ? 0 : options.length - 1;
      if (expanded) setActiveValue(options[index].value); else show(index);
    } else if (!expanded) {
      show(selectedIndex >= 0 ? selectedIndex : event.key === 'ArrowUp' ? options.length - 1 : 0);
    } else {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveValue(options[(activeIndex + step + options.length) % options.length].value);
    }
  };

  return <div ref={container} className="editor-select" data-open={expanded}>
    <style>{styles}</style>
    <button
      ref={trigger} id={id} type="button" role="combobox" className="editor-select-trigger"
      aria-label={label} aria-haspopup="listbox" aria-expanded={expanded}
      aria-controls={expanded ? menuId : undefined}
      aria-activedescendant={expanded ? optionId(activeIndex) : undefined}
      disabled={unavailable} onKeyDown={handleKeyDown}
      onClick={() => { if (expanded) setOpen(false); else show(); }}
    >
      <span className="editor-select-value">{options[selectedIndex]?.label ?? label}</span>
      <span className="editor-select-arrow" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
    </button>
    {expanded && <ul
      ref={menu} id={menuId} role="listbox" aria-label={label} className="editor-select-list"
      style={{
        top: placement.above ? undefined : `calc(100% + ${T.spacingSm})`,
        bottom: placement.above ? `calc(100% + ${T.spacingSm})` : undefined,
        maxHeight: placement.maxHeight,
      }}
    >
      {options.map((option, index) => <li
        key={option.value} id={optionId(index)} role="option" aria-selected={option.value === value}
        className="editor-select-option" data-active={index === activeIndex}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveValue(option.value)} onClick={() => choose(index)}
      >
        <span className="editor-select-option-label">{option.label}</span>
        {option.value === value && <span aria-hidden="true">✓</span>}
      </li>)}
    </ul>}
  </div>;
}
