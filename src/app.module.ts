import { Module } from '@nestjs/common';
import { TradeSettlementModule } from './trade-settlement/trade-settlement.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Trade } from './trade-settlement/entities/trade.entity';
import { Asset } from './asset-registry/entities/asset.entity';
import { BullModule } from '@nestjs/bull';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AssetRegistryModule } from './asset-registry/asset-registry.module';
import { validationSchema } from './config/validation'; 


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available everywhere
      envFilePath: '.env', // Specifies the env file to load
      validationSchema, // Apply our validation schema
      validationOptions: {
        abortEarly: true, // Stop validation on first error
      },
    }),

    // --- Dynamic BullModule Configuration ---
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
      }),
    }),

    // --- Dynamic TypeOrmModule Configuration ---
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: configService.get<string>('DB_TYPE') as any,
        // Add other options for PostgreSQL if needed
        // host: configService.get<string>('DB_HOST'),
        // port: configService.get<number>('DB_PORT'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [Trade, Asset],
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Never sync in prod
      }),
    }),
    TradeSettlementModule,
    BlockchainModule,
    AssetRegistryModule,
  ],
})
export class AppModule {}