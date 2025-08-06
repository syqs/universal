import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDecimal } from 'class-validator';

export class CreateTradeDto {
  @ApiProperty({ example: 'user_wallet_buyer_123' })
  @IsString()
  @IsNotEmpty()
  buyer: string;

  @ApiProperty({ example: 'user_wallet_seller_456' })
  @IsString()
  @IsNotEmpty()
  seller: string;

  @ApiProperty({ example: 'uBTC' })
  @IsString()
  @IsNotEmpty()
  baseAsset: string;

  @ApiProperty({ example: 'uUSD' })
  @IsString()
  @IsNotEmpty()
  quoteAsset: string;

  @ApiProperty({
    description: 'The amount of baseAsset to trade. Must be a valid decimal string.',
    example: '1.5',
  })
  @IsDecimal() // Use IsDecimal validator
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'The price per baseAsset. Must be a valid decimal string.',
    example: '50000.75',
  })
  @IsDecimal()
  @IsString()
  price: string;
}