/**
 * Search trigger button with global keyboard shortcut.
 * Renders a magnifying glass icon styled like ThemeToggle (neu-btn, pill shape).
 * Desktop shows ⌘K shortcut hint. Cmd+K / Ctrl+K opens the dialog.
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SearchDialog from './SearchDialog';

export default function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  // SSR guard: only render portal after client-side mount
  useEffect(() => setMounted(true), []);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <style>{`
        .search-trigger {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.3em;
          height: 2.4em;
          border-radius: 9999px;
          padding: 0 0.6em;
          cursor: pointer;
          color: rgb(var(--gray));
          background: var(--neu-bg);
          border: none;
          font-family: inherit;
          flex-shrink: 0;
          transition: box-shadow 0.2s ease, color 0.2s ease;
        }
        .search-trigger:hover {
          color: rgb(var(--gray-dark));
        }
        .search-trigger-icon {
          width: 1.15em;
          height: 1.15em;
        }
        .search-trigger-hint {
          font-size: 0.7em;
          font-weight: 500;
          opacity: 0.6;
          pointer-events: none;
        }
        @media (max-width: 640px) {
          .search-trigger-hint { display: none; }
          .search-trigger { width: 2.4em; padding: 0; }
        }
      `}</style>

      <button
        type="button"
        className="search-trigger neu-btn"
        onClick={handleOpen}
        aria-label="搜索博文 (⌘K)"
      >
        <svg
          className="search-trigger-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="search-trigger-hint">⌘K</span>
      </button>

      {mounted && createPortal(
        <SearchDialog open={open} onClose={handleClose} />,
        document.body
      )}
    </>
  );
}
