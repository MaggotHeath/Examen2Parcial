import { IsIn, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class UpdateSpaceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsIn(['SALA', 'ESCRITORIO', 'AUDITORIO']) type?: string;
  @IsOptional() @IsUrl() imageUrl?: string;
}
