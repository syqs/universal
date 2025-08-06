import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TradeStatus } from '../interfaces/trade-status.enum';
import Decimal from 'decimal.js';
import { ColumnDecimalTransformer } from '../../common/transformers/column-decimal.transformer';

@Entity()
export class Trade {
  @ApiProperty({
    description: 'Unique identifier for the trade (UUID)',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'uBTC', description: 'The asset being bought/sold' })
  @Column()
  baseAsset: string;

  @ApiProperty({ example: 'uUSD', description: 'The asset used for pricing' })
  @Column()
  quoteAsset: string;

  @ApiProperty({
    type: 'string',
    example: '0.5',
    description: 'The amount of baseAsset traded. Handled as a high-precision string.',
  })
  @Column('varchar', { transformer: new ColumnDecimalTransformer() })
  amount: InstanceType<typeof Decimal>;

  @ApiProperty({
    type: 'string',
    example: '65000.50',
    description: 'The price per unit of baseAsset in terms of quoteAsset.',
  })
  @Column('varchar', { transformer: new ColumnDecimalTransformer() })
  price: InstanceType<typeof Decimal>;

  @ApiProperty({
    type: 'string',
    example: '32500.25',
    description: 'The total value of the trade in the quoteAsset (amount * price).',
  })
  @Column('varchar', { transformer: new ColumnDecimalTransformer() })
  totalQuoteAmount: InstanceType<typeof Decimal>;

  @ApiProperty({ description: 'The user wallet address of the buyer' })
  @Column()
  buyer: string;

  @ApiProperty({ description: 'The user wallet address of the seller' })
  @Column()
  seller: string;

  @ApiProperty({
    enum: TradeStatus,
    enumName: 'TradeStatus',
    description: 'The current status of the trade. Can only be one of the specified values.',
    example: TradeStatus.PENDING,
  })
  @Column({
    type: 'simple-enum',
    enum: TradeStatus,
    default: TradeStatus.PENDING,
  })
  status: TradeStatus;

  @ApiProperty({
    type: 'string',
    example: '32.50',
    description: 'The fee charged for the trade (e.g., 0.1% of totalQuoteAmount).',
  })
  @Column('varchar', { transformer: new ColumnDecimalTransformer(), default: '0' })
  feeAmount: InstanceType<typeof Decimal>;

  @ApiProperty({ example: 'uUSD', description: 'The asset the fee was paid in.' })
  @Column({ default: '' })
  feeAsset: string;

  @ApiProperty({
    required: false,
    example: '0xabc...def',
    description: 'The on-chain transaction hash after settlement.',
  })
  @Column({ nullable: true })
  onChainTxHash?: string;

  @ApiProperty({
    required: false,
    description: 'Reason for trade failure, if applicable.',
    example: 'Insufficient funds',
  })
  @Column({ nullable: true })
  failureReason?: string;

  @ApiProperty({ description: 'Timestamp when the trade was created.' })
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ApiProperty({ required: false, description: 'Timestamp when the trade was settled.' })
  @Column({ type: 'datetime', nullable: true })
  settledAt?: Date;
}