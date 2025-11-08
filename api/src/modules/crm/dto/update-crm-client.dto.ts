import { IsEmail, IsOptional, IsUUID } from 'class-validator';

export class UpdateCRMClientDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  @IsUUID()
  credential_id?: string;

  @IsOptional()
  expires_at?: Date;

  @IsOptional()
  notes?: string;
}
