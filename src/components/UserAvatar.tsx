// src/components/UserAvatar.tsx

import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { generateIdenticon } from '@/lib/identicon';

type AvatarSize = 'sm' | 'md' | 'lg';

export function UserAvatar({ radixAddress, avatarUrl, size = 'sm', className }: {
  radixAddress: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={cn('user-avatar', `user-avatar-${size}`, className)} />;
  }

  const { cells, fg, bg } = generateIdenticon(radixAddress);

  return (
    <svg viewBox="0 0 5 5" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" className={cn('user-avatar', `user-avatar-${size}`, className)}>
      <rect width="5" height="5" fill={bg} />
      {cells.map((on, i) => {
        if (!on) return null;
        const row = Math.floor(i / 3);
        const col = i % 3;
        return (
          <Fragment key={i}>
            <rect x={col} y={row} width={1} height={1} fill={fg} />
            {col < 2 && <rect x={4 - col} y={row} width={1} height={1} fill={fg} />}
          </Fragment>
        );
      })}
    </svg>
  );
}
