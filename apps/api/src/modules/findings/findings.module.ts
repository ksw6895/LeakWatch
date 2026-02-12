import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';
import { FindingsController } from './findings.controller';

@Module({
  imports: [DocumentsModule],
  controllers: [FindingsController],
})
export class FindingsModule {}
