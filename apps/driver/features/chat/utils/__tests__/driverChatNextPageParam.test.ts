/**
 * Regression guard for GX-PULSE-1H
 * ("n.getNextPageParam is not a function").
 *
 * The driver thread's cursor was duplicated between the live infinite query and
 * the navigation prefetch. The prefetch copy was missing entirely, so warming a
 * thread seeded an infinite query whose observer later called an undefined
 * getNextPageParam. Both now share this helper — these tests pin its contract so
 * a future caller cannot silently drift again.
 */
import { driverChatNextPageParam } from '../driverChatMessageCache.util';
import type { TripMessageRow } from '@pulse/domain/features/chat/types/chat.types';

const PAGE_SIZE = 30;

function rows(count: number, firstCreatedAt = '2026-07-30T10:00:00.000Z') {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    created_at: i === 0 ? firstCreatedAt : `2026-07-30T10:0${i}:00.000Z`,
  })) as unknown as TripMessageRow[];
}

describe('driverChatNextPageParam', () => {
  it('returns the oldest message timestamp when a full page came back', () => {
    const page = { rows: rows(PAGE_SIZE, '2026-07-30T09:00:00.000Z') };
    expect(driverChatNextPageParam(page, PAGE_SIZE)).toBe(
      '2026-07-30T09:00:00.000Z',
    );
  });

  it('stops paginating on a partial page', () => {
    expect(driverChatNextPageParam({ rows: rows(PAGE_SIZE - 1) }, PAGE_SIZE)).toBeUndefined();
  });

  it('stops paginating on an empty page', () => {
    expect(driverChatNextPageParam({ rows: [] }, PAGE_SIZE)).toBeUndefined();
  });
});

describe('driver chat pagination wiring', () => {
  it('the prefetch and the live query pass the same cursor function', () => {
    // Both modules must import the shared helper rather than inlining the
    // cursor. A missing getNextPageParam in either is what caused GX-PULSE-1H.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../../..');
    for (const file of [
      'lib/preloadDriverChatWarmup.ts',
      'features/chat/hooks/useDriverChatMessagesQuery.ts',
    ]) {
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      expect(src).toContain('driverChatNextPageParam');
      expect(src).toContain('getNextPageParam');
    }
  });
});
