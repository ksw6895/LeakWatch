import {
  Cadence,
  DocStatus,
  LineItemType,
  type PrismaClient,
  VendorCategory,
  VendorStatus,
} from '@prisma/client';

import type { NormalizedInvoice } from './types';
import { incrementOpenAiUsage } from './usage';

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeDecimal(value: string | undefined): string | null {
  const raw = clean(value);
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function toDate(value: string | undefined) {
  const raw = clean(value);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapVendorCategory(value: string | undefined): VendorCategory {
  if (value && value in VendorCategory) {
    return value as VendorCategory;
  }
  return VendorCategory.UNKNOWN;
}

function mapLineItemType(value: string): LineItemType {
  if (value in LineItemType) {
    return value as LineItemType;
  }
  return LineItemType.CHARGE;
}

function mapCadence(value: string | undefined): Cadence | null {
  if (!value) {
    return null;
  }
  if (value in Cadence) {
    return value as Cadence;
  }
  return null;
}

export async function persistNormalizedInvoice(
  prisma: PrismaClient,
  args: {
    documentVersionId: string;
    orgId: string;
    shopId: string;
    normalizedInvoice: NormalizedInvoice;
    tokenUsage: TokenUsage;
  },
) {
  const vendorName = clean(args.normalizedInvoice.vendor.name) ?? 'Unknown Vendor';
  const canonicalName = clean(args.normalizedInvoice.vendor.canonicalName) ?? vendorName;
  const invoiceCurrency = clean(args.normalizedInvoice.invoice.currency)?.toUpperCase() ?? 'USD';
  const totalAmount = normalizeDecimal(args.normalizedInvoice.invoice.totalAmount) ?? '0';

  const result = await prisma.$transaction(async (tx) => {
    const existingVendor = await tx.vendor.findUnique({
      where: {
        canonicalName,
      },
    });

    const vendor = existingVendor
      ? await tx.vendor.update({
          where: { id: existingVendor.id },
          data: {
            aliases: Array.from(new Set([vendorName, ...existingVendor.aliases])),
            category: mapVendorCategory(args.normalizedInvoice.vendor.category),
          },
        })
      : await tx.vendor.create({
          data: {
            canonicalName,
            aliases: [vendorName],
            category: mapVendorCategory(args.normalizedInvoice.vendor.category),
            supportEmail: clean(args.normalizedInvoice.vendor.supportEmail),
            website: clean(args.normalizedInvoice.vendor.website),
          },
        });

    await tx.vendorOnShop.upsert({
      where: {
        shopId_vendorId: {
          shopId: args.shopId,
          vendorId: vendor.id,
        },
      },
      create: {
        shopId: args.shopId,
        vendorId: vendor.id,
        status: VendorStatus.ACTIVE,
        lastSeenAt: new Date(),
      },
      update: {
        status: VendorStatus.ACTIVE,
        lastSeenAt: new Date(),
      },
    });

    const existingInvoice = await tx.normalizedInvoice.findUnique({
      where: { documentVersionId: args.documentVersionId },
      select: { id: true },
    });

    if (existingInvoice) {
      await tx.normalizedLineItem.deleteMany({
        where: {
          invoiceId: existingInvoice.id,
        },
      });
    }

    const normalizedInvoice = await tx.normalizedInvoice.upsert({
      where: {
        documentVersionId: args.documentVersionId,
      },
      create: {
        documentVersionId: args.documentVersionId,
        vendorId: vendor.id,
        currency: invoiceCurrency,
        invoiceNumber: clean(args.normalizedInvoice.invoice.invoiceNumber),
        invoiceDate: toDate(args.normalizedInvoice.invoice.invoiceDate),
        billingPeriodStart: toDate(args.normalizedInvoice.invoice.billingPeriodStart),
        billingPeriodEnd: toDate(args.normalizedInvoice.invoice.billingPeriodEnd),
        totalAmount,
        rawJson: args.normalizedInvoice,
      },
      update: {
        vendorId: vendor.id,
        currency: invoiceCurrency,
        invoiceNumber: clean(args.normalizedInvoice.invoice.invoiceNumber),
        invoiceDate: toDate(args.normalizedInvoice.invoice.invoiceDate),
        billingPeriodStart: toDate(args.normalizedInvoice.invoice.billingPeriodStart),
        billingPeriodEnd: toDate(args.normalizedInvoice.invoice.billingPeriodEnd),
        totalAmount,
        rawJson: args.normalizedInvoice,
      },
    });

    const lineItems = args.normalizedInvoice.lineItems.map((lineItem) => ({
      invoiceId: normalizedInvoice.id,
      shopId: args.shopId,
      vendorId: vendor.id,
      itemType: mapLineItemType(lineItem.type),
      description: clean(lineItem.description),
      quantity: normalizeDecimal(lineItem.quantity),
      unitPrice: normalizeDecimal(lineItem.unitPrice),
      amount: normalizeDecimal(lineItem.amount) ?? '0',
      currency: clean(lineItem.currency)?.toUpperCase() ?? invoiceCurrency,
      periodStart: toDate(lineItem.periodStart),
      periodEnd: toDate(lineItem.periodEnd),
      isRecurring: Boolean(lineItem.isRecurring),
      recurringCadence: mapCadence(lineItem.recurringCadence),
      planName: clean(lineItem.planName),
      productCode: clean(lineItem.productCode),
      taxAmount: normalizeDecimal(lineItem.taxAmount),
    }));

    if (lineItems.length > 0) {
      await tx.normalizedLineItem.createMany({
        data: lineItems,
      });
    }

    await incrementOpenAiUsage(tx, {
      orgId: args.orgId,
      shopId: args.shopId,
      inputTokens: args.tokenUsage.inputTokens,
      outputTokens: args.tokenUsage.outputTokens,
    });

    await tx.documentVersion.update({
      where: { id: args.documentVersionId },
      data: {
        status: DocStatus.NORMALIZED,
        errorCode: null,
        errorMessage: null,
      },
    });

    return {
      invoiceId: normalizedInvoice.id,
      vendorId: vendor.id,
      lineItemCount: lineItems.length,
    };
  });

  return result;
}
