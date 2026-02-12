import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CreateDocumentUploadDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  fileName!: string;

  @IsString()
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  byteSize!: number;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  sha256!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  vendorHint?: string;
}
