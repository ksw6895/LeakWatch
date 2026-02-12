import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';

import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { EvidenceService } from './evidence.service';

@Controller('evidence-packs')
export class EvidenceController {
  constructor(@Inject(EvidenceService) private readonly evidenceService: EvidenceService) {}

  @Get(':id/download')
  async download(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const result = await this.evidenceService.getDownloadUrl(auth.orgId, id);
    if (!result) {
      throw new NotFoundException('Evidence pack not found');
    }
    return result;
  }
}
