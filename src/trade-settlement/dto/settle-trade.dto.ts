import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SettleTradeDto {
  @ApiProperty()
  @IsString()
  tradeId: string;
}