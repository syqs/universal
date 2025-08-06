import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './entities/asset.entity';
import { AssetRegistryService } from './asset-registry.service';
import { AssetController } from './asset-registry.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Asset])],
  providers: [AssetRegistryService],
  controllers: [AssetController],
  exports: [AssetRegistryService],
})
export class AssetRegistryModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(AssetRegistryModule.name);

  constructor(private readonly assetRegistryService: AssetRegistryService) {}

  /**
   * This hook is guaranteed to run after all modules are initialized and
   * the application is ready.
   */
  async onApplicationBootstrap() {
    this.logger.log('Application bootstrap finished. Seeding initial assets...');
    await this.assetRegistryService.seedInitialAssets();
    this.logger.log('Asset seeding complete.');
  }
}