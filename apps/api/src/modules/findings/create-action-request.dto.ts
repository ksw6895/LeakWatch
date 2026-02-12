import { ActionType } from '@prisma/client';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActionRequestDto {
  @IsEnum(ActionType)
  type!: ActionType;

  @IsEmail()
  toEmail!: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  ccEmails?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  bodyMarkdown?: string;
}
