import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class InstalledAppsSyncDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  installedApps!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;
}
