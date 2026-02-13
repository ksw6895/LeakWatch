import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';
import { ActionsController } from './actions.controller';

@Module({
  imports: [DocumentsModule],
  controllers: [ActionsController],
})
export class ActionsModule {}
