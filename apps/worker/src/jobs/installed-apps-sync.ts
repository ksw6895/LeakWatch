import { VendorStatus } from '@prisma/client';
import type { InstalledAppsSyncJobPayload } from '@leakwatch/shared';
import type pino from 'pino';

import { prisma } from '../db';

const STALE_SYNC_THRESHOLD_HOURS = 72;

type InstalledAppsSyncMeta = {
  source?: unknown;
  installedAppsNormalized?: unknown;
};

export function toInstalledApps(metaJson: unknown): string[] {
  if (!metaJson || typeof metaJson !== 'object') {
    return [];
  }
  const meta = metaJson as InstalledAppsSyncMeta;
  if (!Array.isArray(meta.installedAppsNormalized)) {
    return [];
  }
  return meta.installedAppsNormalized.filter((value): value is string => typeof value === 'string');
}

export async function processInstalledAppsSyncJob(
  payload: InstalledAppsSyncJobPayload,
  logger: pino.Logger,
) {
  const shop = await prisma.shop.findUnique({
    where: {
      id: payload.shopId,
    },
    select: {
      id: true,
      orgId: true,
      uninstalledAt: true,
    },
  });

  if (!shop || shop.uninstalledAt) {
    return { skipped: true, reason: 'SHOP_NOT_FOUND' };
  }

  const latestSyncAudit = await prisma.auditLog.findFirst({
    where: {
      orgId: shop.orgId,
      shopId: shop.id,
      action: 'SHOP_INSTALLED_APPS_SYNCED',
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      metaJson: true,
    },
  });

  const installedApps = toInstalledApps(latestSyncAudit?.metaJson ?? null);
  if (!latestSyncAudit || installedApps.length === 0) {
    await prisma.auditLog.create({
      data: {
        orgId: shop.orgId,
        shopId: shop.id,
        action: 'SHOP_INSTALLED_APPS_SYNC_ALERTED',
        targetType: 'shop',
        targetId: shop.id,
        metaJson: {
          trigger: payload.trigger,
          reason: 'NO_BASELINE_SNAPSHOT',
        },
      },
    });
    return { skipped: true, reason: 'NO_BASELINE_SNAPSHOT' };
  }

  const staleHours = (Date.now() - latestSyncAudit.createdAt.getTime()) / (1000 * 60 * 60);
  if (staleHours >= STALE_SYNC_THRESHOLD_HOURS) {
    await prisma.auditLog.create({
      data: {
        orgId: shop.orgId,
        shopId: shop.id,
        action: 'SHOP_INSTALLED_APPS_SYNC_ALERTED',
        targetType: 'shop',
        targetId: shop.id,
        metaJson: {
          trigger: payload.trigger,
          reason: 'SYNC_STALE',
          thresholdHours: STALE_SYNC_THRESHOLD_HOURS,
          staleHours,
          lastSyncedAt: latestSyncAudit.createdAt.toISOString(),
        },
      },
    });
  }

  const normalizedInput = new Set(
    installedApps.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
  );

  const vendorOnShops = await prisma.vendorOnShop.findMany({
    where: {
      shopId: shop.id,
    },
    include: {
      vendor: {
        select: {
          canonicalName: true,
          aliases: true,
        },
      },
    },
  });

  let activeCount = 0;
  let suspectedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const relation of vendorOnShops) {
      const candidates = [relation.vendor.canonicalName, ...relation.vendor.aliases]
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0);
      const isInstalled = candidates.some((value) => normalizedInput.has(value));

      await tx.vendorOnShop.update({
        where: {
          id: relation.id,
        },
        data: {
          status: isInstalled ? VendorStatus.ACTIVE : VendorStatus.SUSPECTED_UNUSED,
          notes: isInstalled
            ? relation.notes
            : `Snapshot mismatch from scheduled at ${new Date().toISOString()}`,
        },
      });

      if (isInstalled) {
        activeCount += 1;
      } else {
        suspectedCount += 1;
      }
    }

    await tx.auditLog.create({
      data: {
        orgId: shop.orgId,
        shopId: shop.id,
        userId: latestSyncAudit.userId,
        action: 'SHOP_INSTALLED_APPS_SYNCED',
        targetType: 'shop',
        targetId: shop.id,
        metaJson: {
          source: payload.trigger,
          installedAppsInputCount: normalizedInput.size,
          installedAppsNormalized: Array.from(normalizedInput).sort(),
          vendorsTracked: vendorOnShops.length,
          activeCount,
          suspectedCount,
          baselineAuditId: latestSyncAudit.id,
        },
      },
    });
  });

  logger.info(
    {
      orgId: shop.orgId,
      shopId: shop.id,
      activeCount,
      suspectedCount,
      trigger: payload.trigger,
    },
    'Installed-app snapshot sync completed',
  );

  return {
    ok: true,
    activeCount,
    suspectedCount,
    vendorsTracked: vendorOnShops.length,
    source: payload.trigger,
  };
}
