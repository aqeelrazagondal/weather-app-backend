import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @Transform(({ value }) => (value ? parseInt(String(value), 10) : 1))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 10, description: 'Page size (max 50)' })
  @Transform(({ value }) => (value ? parseInt(String(value), 10) : 10))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}
