import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Asset {
  @ApiProperty({ description: 'Internal unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'uBTC', description: 'The official symbol of the asset.' })
  @Column({ unique: true })
  @Index()
  symbol: string;

  @ApiProperty({ example: 'Universal Bitcoin', description: 'The full name of the asset.' })
  @Column()
  name: string;

  @ApiProperty({ example: '0x...', description: 'The smart contract address of the uAsset token.' })
  @Column()
  contractAddress: string;
  
  @ApiProperty({ example: 'Ethereum', description: 'The blockchain where the uAsset contract resides.' })
  @Column()
  blockchain: string;

  @ApiProperty({ example: 'BTC', description: 'The underlying asset that this uAsset represents.' })
  @Column()
  underlyingAssetSymbol: string;

  @ApiProperty({ example: 8, description: 'The number of decimal places the token supports.' })
  @Column()
  decimals: number;

  @ApiProperty({ description: 'Whether the asset is active and can be used.' })
  @Column({ default: true })
  isActive: boolean;
  
  @ApiProperty({ description: 'Whether the asset can be traded on the exchange.' })
  @Column({ default: true })
  isTradable: boolean;
}