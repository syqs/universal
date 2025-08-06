import { Module } from '@nestjs/common';
import { TradeSettlementController } from './trade-settlement.controller';
import { TradeSettlementService } from './trade-settlement.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trade } from './entities/trade.entity';
import { BullModule } from '@nestjs/bull';
import { SettlementProcessor } from './settlement.processor'
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade]),
    // Register the 'settlement' queue
    BullModule.registerQueue({
      name: 'settlement',
    }),
    BlockchainModule,
  ],
  controllers: [TradeSettlementController],
  providers: [TradeSettlementService, SettlementProcessor],
})
export class TradeSettlementModule {}