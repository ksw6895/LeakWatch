import { describe, expect, it } from 'vitest';

import { toInstalledApps } from '../src/jobs/installed-apps-sync';

describe('installed-apps sync helpers', () => {
  it('extracts normalized installed app list from audit metadata', () => {
    const result = toInstalledApps({
      installedAppsNormalized: ['klaviyo', 'recharge'],
    });

    expect(result).toEqual(['klaviyo', 'recharge']);
  });

  it('returns empty list for malformed metadata', () => {
    expect(toInstalledApps(null)).toEqual([]);
    expect(toInstalledApps({})).toEqual([]);
    expect(toInstalledApps({ installedAppsNormalized: [1, 'ok'] })).toEqual(['ok']);
  });
});
