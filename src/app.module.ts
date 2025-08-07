import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

// --- Application Modules ---
import { TradeSettlementModule } from './trade-settlement/trade-settlement.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AssetRegistryModule } from './asset-registry/asset-registry.module';
import { AuthModule } from './auth/auth.module';
import { VaultModule } from './vault/vault.module';
import { CryptoModule } from './crypto/crypto.module';

// --- Configuration & Entities ---
import { validationSchema } from './config/validation';
import { Trade } from './trade-settlement/entities/trade.entity';
import { Asset } from './asset-registry/entities/asset.entity';
import { Vault } from './vault/entities/vault.entity';

@Module({
  imports: [
    // --- Core Modules ---
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: configService.get<string>('DB_TYPE') as any,
        database: configService.get<string>('DB_DATABASE'),
        entities: [Trade, Asset, Vault],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // --- Feature Modules ---
    AuthModule,
    VaultModule,
    CryptoModule,
    TradeSettlementModule,
    BlockchainModule,
    AssetRegistryModule,
  ],
})
export class AppModule {}