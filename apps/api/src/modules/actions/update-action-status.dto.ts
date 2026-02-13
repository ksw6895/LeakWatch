import { IsIn } from 'class-validator';

export class UpdateActionStatusDto {
  @IsIn(['WAITING_REPLY', 'RESOLVED'])
  status!: 'WAITING_REPLY' | 'RESOLVED';
}
