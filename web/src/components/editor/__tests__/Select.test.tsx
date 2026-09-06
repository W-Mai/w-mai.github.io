// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditorSelect from '../shared/Select';

const options = [
  { value: 'all', label: '全部目录' },
  { value: 'root', label: '根目录' },
  { value: '中文/资料', label: '中文资料' },
];

function setup(value = 'root') {
  const onChange = vi.fn();
  const result = render(<EditorSelect id="directories" label="筛选目录" value={value} options={options} onChange={onChange} />);
  return { ...result, onChange, trigger: screen.getByRole('combobox', { name: '筛选目录' }) };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('editor select interaction contract', () => {
  it('exposes the selected label and active option without a native select', () => {
    const { container, trigger } = setup();
    expect(trigger.textContent).toContain('根目录');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('select')).toBeNull();
    fireEvent.click(trigger);
    const list = screen.getByRole('listbox', { name: '筛选目录' });
    expect(trigger.getAttribute('aria-controls')).toBe(list.id);
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: /根目录/ }).id);
    expect(screen.getByRole('option', { name: /根目录/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('moves the highlight with arrows and Home/End, committing only on Enter or Space', () => {
    const { trigger, onChange } = setup();
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: '中文资料' }).id);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: 'Home' });
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: '全部目录' }).id);
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('all');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: ' ' });
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith('中文/资料');
  });

  it('cancels with Escape without bubbling to the parent and lets Tab move focus normally', async () => {
    const parentKeyDown = vi.fn();
    const onChange = vi.fn();
    render(<div onKeyDown={parentKeyDown}>
      <EditorSelect id="directory" label="目录" value="root" options={options} onChange={onChange} />
      <button type="button">下一个</button>
    </div>);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    parentKeyDown.mockClear();
    fireEvent.keyDown(trigger, { key: 'End' });
    parentKeyDown.mockClear();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(parentKeyDown).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(parentKeyDown).toHaveBeenCalledTimes(1);
    fireEvent.click(trigger);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '下一个' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selects by mouse, restores trigger focus, and closes on an outside pointer', () => {
    const { trigger, onChange } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: '中文资料' }));
    expect(onChange).toHaveBeenCalledWith('中文/资料');
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps externally controlled values and changing options synchronized', () => {
    const { trigger, rerender, onChange } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'End' });
    rerender(<EditorSelect id="directories" label="筛选目录" value="all" options={options} onChange={onChange} />);
    expect(trigger.textContent).toContain('全部目录');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: /全部目录/ }).id);
    fireEvent.keyDown(trigger, { key: 'End' });
    rerender(<EditorSelect id="directories" label="筛选目录" value="all" options={options.slice(0, 2)} onChange={onChange} />);
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: /全部目录/ }).id);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cannot open or commit when disabled or empty and closes if disabled while open', () => {
    const { trigger, rerender, onChange } = setup();
    fireEvent.click(trigger);
    rerender(<EditorSelect id="directories" label="筛选目录" value="root" options={options} onChange={onChange} disabled />);
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<EditorSelect id="directories" label="筛选目录" value="root" options={[]} onChange={onChange} />);
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('remeasures parent scrolling without dismissing a pending option click or resetting the highlight', () => {
    const onChange = vi.fn();
    render(<div data-testid="clip" style={{ overflowY: 'auto' }}>
      <EditorSelect id="directory" label="目录" value="root" options={options} onChange={onChange} />
    </div>);
    const clip = screen.getByTestId('clip');
    const trigger = screen.getByRole('combobox');
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 240, width: 240, height: bottom - top, x: 0, y: top, toJSON: () => ({}) });
    vi.spyOn(clip, 'getBoundingClientRect').mockReturnValue(rect(100, 300));
    Object.defineProperty(clip, 'clientHeight', { configurable: true, value: 200 });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(250, 286));
    fireEvent.click(trigger);
    const list = screen.getByRole('listbox');
    const target = screen.getByRole('option', { name: '中文资料' });
    fireEvent.mouseEnter(target);
    const before = parseFloat(list.style.maxHeight);
    vi.mocked(trigger.getBoundingClientRect).mockReturnValue(rect(220, 256));
    fireEvent.scroll(clip);
    expect(screen.getByRole('listbox')).toBe(list);
    expect(target.isConnected).toBe(true);
    expect(parseFloat(list.style.maxHeight)).toBeLessThan(before);
    expect(trigger.getAttribute('aria-activedescendant')).toBe(target.id);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(target);
    expect(onChange).toHaveBeenCalledWith('中文/资料');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps the menu inside a dialog and chooses the space above a clipped trigger', () => {
    const onChange = vi.fn();
    render(<dialog open><div data-testid="clip" style={{ overflowY: 'auto' }}>
      <EditorSelect id="directory" label="目录" value="all" options={options} onChange={onChange} />
    </div></dialog>);
    const clip = screen.getByTestId('clip');
    const trigger = screen.getByRole('combobox');
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 240, width: 240, height: bottom - top, x: 0, y: top, toJSON: () => ({}) });
    vi.spyOn(clip, 'getBoundingClientRect').mockReturnValue(rect(100, 300));
    Object.defineProperty(clip, 'clientHeight', { configurable: true, value: 200 });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(250, 286));
    fireEvent.click(trigger);
    const list = screen.getByRole('listbox');
    expect(list.closest('dialog')).toBe(screen.getByRole('dialog'));
    expect(list.style.bottom).not.toBe('');
    expect(parseFloat(list.style.maxHeight)).toBeLessThanOrEqual(150);
    fireEvent.scroll(list);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.scroll(clip);
    expect(screen.getByRole('listbox')).toBe(list);
    vi.mocked(trigger.getBoundingClientRect).mockReturnValue(rect(40, 76));
    fireEvent.scroll(clip);
    expect(screen.queryByRole('listbox')).toBeNull();
    vi.mocked(trigger.getBoundingClientRect).mockReturnValue(rect(250, 286));
    fireEvent.click(trigger);
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
