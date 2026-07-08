import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateReservationDto {
  @IsInt()
  spaceId: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
