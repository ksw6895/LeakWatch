import { Global, Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthContextService } from './auth-context.service';
import { RolesGuard } from './roles.guard';
import { ShopifySessionGuard } from './shopify-session.guard';
import { TenantPrismaService } from './tenant-prisma.service';
import { TenantGuard } from './tenant.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthContextService,
    TenantPrismaService,
    ShopifySessionGuard,
    TenantGuard,
    RolesGuard,
  ],
  exports: [
    AuthContextService,
    TenantPrismaService,
    ShopifySessionGuard,
    TenantGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
