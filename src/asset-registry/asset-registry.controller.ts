import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { Asset } from './entities/asset.entity';
import { AssetRegistryService } from './asset-registry.service';

@ApiTags('assets')
@Controller('assets')
export class AssetController {
  constructor(private readonly assetRegistryService: AssetRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'List all active and tradable assets' })
  @ApiResponse({ status: 200, description: 'An array of supported assets.', type: [Asset] })
  async findAll(): Promise<Asset[]> {
    return this.assetRegistryService.findAll();
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Get details for a specific asset by symbol' })
  @ApiParam({ name: 'symbol', description: 'The asset symbol, e.g., uBTC', type: 'string' })
  @ApiResponse({ status: 200, description: 'The asset details.', type: Asset })
  @ApiResponse({ status: 404, description: 'Asset not found or not tradable.' })
  async findOne(@Param('symbol') symbol: string): Promise<Asset> {
    const asset = await this.assetRegistryService.findTradableAssetBySymbol(symbol.toUpperCase());
    if (!asset) {
      throw new NotFoundException(`Asset ${symbol} not found or is not tradable.`);
    }
    return asset;
  }
}