import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';

@Injectable()
export class AssetRegistryService {
  private readonly logger = new Logger(AssetRegistryService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
  ) {}

  /**
   * Finds a single asset by its symbol. Throws an error if not found or not tradable or not active.
   * This is the core validation method.
   */
  async findTradableAssetBySymbol(symbol: string): Promise<Asset> {
    const asset = await this.assetRepository.findOneBy({ symbol });

    if (!asset) {
      throw new NotFoundException(`Asset with symbol "${symbol}" not found.`);
    }
    if (!asset.isActive || !asset.isTradable) {
      throw new NotFoundException(`Asset "${symbol}" is not currently tradable.`);
    }
    return asset;
  }
  
  async findAll(): Promise<Asset[]> {
    return this.assetRepository.find({ where: { isActive: true }, order: { symbol: 'ASC' } });
  }

  /**
   * Seeds the database with some default assets if they don't already exist.
   * In a real production environment, this would be an admin-controlled process.
   */
  public async seedInitialAssets() {
    const assetsToSeed = [
      {
        symbol: 'UBTC', // Standardizing to uppercase for easier lookup
        name: 'Universal Bitcoin',
        contractAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        blockchain: 'Ethereum',
        underlyingAssetSymbol: 'BTC',
        decimals: 8,
        isActive: true,
        isTradable: true,
      },
      {
        symbol: 'UUSD',
        name: 'Universal USD',
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        blockchain: 'Ethereum',
        underlyingAssetSymbol: 'USD',
        decimals: 6,
        isActive: true,
        isTradable: true,
      },
      {
        symbol: 'UETH',
        name: 'Universal Ether',
        contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        blockchain: 'Ethereum',
        underlyingAssetSymbol: 'ETH',
        decimals: 18,
        isActive: true,
        isTradable: true,
      },
    ];

    for (const assetData of assetsToSeed) {
      const existingAsset = await this.assetRepository.findOneBy({ symbol: assetData.symbol });
      if (!existingAsset) {
        this.logger.log(`Seeding asset: ${assetData.symbol}`);
        const asset = this.assetRepository.create(assetData);
        await this.assetRepository.save(asset);
      }
    }
  }
}