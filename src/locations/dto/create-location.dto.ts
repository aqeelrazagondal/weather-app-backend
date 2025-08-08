import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'London' })
  @IsString()
  name: string;

  @ApiProperty({ example: 51.5074, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -0.1278, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  // Note: clientId will be taken from header, not from body. Kept optional to avoid payload issues.
  @IsOptional()
  @IsString()
  clientId?: string;
}
