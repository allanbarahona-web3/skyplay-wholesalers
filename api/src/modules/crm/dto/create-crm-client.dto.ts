import { IsEmail, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCRMClientDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

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
