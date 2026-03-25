// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagChipEditor from '../post/panels/TagChip';

describe('TagChipEditor', () => {
  const defaultTags = ['react', 'typescript', 'vitest'];

  it('renders chips for given tags', () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<TagChipEditor tags={defaultTags} onAdd={onAdd} onRemove={onRemove} />);

    for (const tag of defaultTags) {
      expect(screen.getByText(tag)).toBeTruthy();
    }
    // Each chip has a remove button
    const removeButtons = screen.getAllByRole('button', { name: /remove tag/i });
    expect(removeButtons).toHaveLength(defaultTags.length);
  });

  it('calls onAdd when Enter pressed with new tag', async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<TagChipEditor tags={defaultTags} onAdd={onAdd} onRemove={onRemove} />);

    const input = screen.getByPlaceholderText('Add tag, press Enter');
    await userEvent.type(input, 'newTag{Enter}');

    expect(onAdd).toHaveBeenCalledWith('newTag');
  });

  it('clears input after successful add', async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<TagChipEditor tags={defaultTags} onAdd={onAdd} onRemove={onRemove} />);

    const input = screen.getByPlaceholderText('Add tag, press Enter') as HTMLInputElement;
    await userEvent.type(input, 'newTag{Enter}');

    expect(input.value).toBe('');
  });

  it('calls onRemove when × button clicked', async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<TagChipEditor tags={defaultTags} onAdd={onAdd} onRemove={onRemove} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove tag/i });
    await userEvent.click(removeButtons[1]);

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('shows warning for duplicate tag and does NOT call onAdd', async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<TagChipEditor tags={defaultTags} onAdd={onAdd} onRemove={onRemove} />);

    const input = screen.getByPlaceholderText('Add tag, press Enter');
    await userEvent.type(input, 'react{Enter}');

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText('Tag "react" already exists')).toBeTruthy();
  });

  it('does not call onAdd when Enter pressed with empty input', async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<TagChipEditor tags={defaultTags} onAdd={onAdd} onRemove={onRemove} />);

    const input = screen.getByPlaceholderText('Add tag, press Enter');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAdd).not.toHaveBeenCalled();
  });
});
