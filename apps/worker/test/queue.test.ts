import { describe, expect, it } from 'vitest';

import { ingestionQueue } from '../src/queue';

describe('worker queue', () => {
  it('creates ingestion queue with name', () => {
    expect(ingestionQueue.name).toBe('ingestion');
  });
});
