import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateShopSettingsDto {
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  timezone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
