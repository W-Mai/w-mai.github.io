import type { FC } from 'react';

interface Props {
  thoughtId: string;
}

/**
 * Comment icon for thought cards.
 * Displayed as a simple entry point — no count fetched to avoid API limitations.
 */
const ThoughtCommentCount: FC<Props> = () => {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        lineHeight: 1,
      }}
    >
      💬
    </span>
  );
};

export default ThoughtCommentCount;
