import { Module } from '@nestjs/common';
import { TradeSettlementController } from './trade-settlement.controller';
import { TradeSettlementService } from './trade-settlement.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trade } from './entities/trade.entity';
import { BullModule } from '@nestjs/bull';
import { SettlementProcessor } from './settlement.processor'
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AssetRegistryModule } from '../asset-registry/asset-registry.module';
import { VaultModule } from '../vault/vault.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade]),
    BullModule.registerQueue({
      name: 'settlement',
    }),
    BlockchainModule,
    AssetRegistryModule,
    VaultModule, 
  ],
  controllers: [TradeSettlementController],
  providers: [TradeSettlementService, SettlementProcessor],
})
export class TradeSettlementModule {}