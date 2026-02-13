import { IsString, Length } from 'class-validator';

export class AttachConnectCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
