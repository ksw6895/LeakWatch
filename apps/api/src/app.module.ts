import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { ActionsModule } from './modules/actions/actions.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesGuard } from './modules/auth/roles.guard';
import { ShopifySessionGuard } from './modules/auth/shopify-session.guard';
import { TenantGuard } from './modules/auth/tenant.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { DocumentsModule } from './modules/documents/documents.module';
import { FindingsModule } from './modules/findings/findings.module';
import { HealthController } from './modules/health/health.controller';
import { ReportsModule } from './modules/reports/reports.module';
import { ShopifyModule } from './modules/shopify/shopify.module';
import { ShopsModule } from './modules/shops/shops.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    ShopifyModule,
    ShopsModule,
    DocumentsModule,
    FindingsModule,
    ActionsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ShopifySessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
