import { Module } from '@nestjs/common';
import { TradeSettlementModule } from './trade-settlement/trade-settlement.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trade } from './trade-settlement/entities/trade.entity';
import { Asset } from './asset-registry/entities/asset.entity';
import { BullModule } from '@nestjs/bull';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AssetRegistryModule } from './asset-registry/asset-registry.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Assumes a Redis server is running on localhost:6379
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'data/db.sqlite',
      entities: [Trade, Asset],
      synchronize: true,
    }),
    TradeSettlementModule,
    BlockchainModule,
    AssetRegistryModule,
  ],
})
export class AppModule {}