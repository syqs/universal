import { Injectable, NotFoundException, Logger, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CreateTradeDto } from './dto/create-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeStatus } from './interfaces/trade-status.enum';
import Decimal from 'decimal.js';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AssetRegistryService } from '../asset-registry/asset-registry.service';
import { VaultService } from '../vault/vault.service';

interface AuthenticatedUser {
  sub: string; // The owner's main address
  sessionKey: string;
}

@Injectable()
export class TradeSettlementService {
  private readonly logger = new Logger(TradeSettlementService.name);
  private readonly vaultService: VaultService;

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly blockchainService: BlockchainService,
    private readonly entityManager: EntityManager,
    private readonly assetRegistryService: AssetRegistryService,
  ) {}

  async create(createTradeDto: CreateTradeDto, user: AuthenticatedUser): Promise<Trade> {

    if (createTradeDto.buyer !== user.sub) {
      throw new UnauthorizedException('Buyer address does not match authenticated user.');
    }
    // Check if the session key is valid and authorized
    const vault = await this.vaultService.findOne(user.sub);
    if (!vault || vault.delegatedSessionKey !== user.sessionKey || new Date() > vault.delegationExpiresAt) {
      throw new UnauthorizedException('Session key is invalid or expired.');
    }
    // In a real system, we would first call a LedgerService to place a hold on the seller's funds.
    const { buyer, seller, baseAsset: baseSymbol, quoteAsset: quoteSymbol, amount, price } = createTradeDto;
    this.logger.log(`Creating trade: ${JSON.stringify(createTradeDto)}`);
    // 1. Validate that both assets exist, are active, and are tradable
    const baseAsset = await this.assetRegistryService.findTradableAssetBySymbol(baseSymbol.toUpperCase());
    const quoteAsset = await this.assetRegistryService.findTradableAssetBySymbol(quoteSymbol.toUpperCase());
    if (!baseAsset || !quoteAsset) {
      throw new NotFoundException(`One or both assets (${baseSymbol}, ${quoteSymbol}) not found or not tradable. ${baseAsset}, ${quoteAsset}`);
    }
    // 2. Validate the decimal places of the input amount
    const amountDecimal = new Decimal(amount);
    if (amountDecimal.decimalPlaces() > baseAsset.decimals) {
      throw new BadRequestException(
        `Amount for ${baseAsset.symbol} exceeds the maximum allowed decimals of ${baseAsset.decimals}.`
      );
    }
    
    const priceDecimal = new Decimal(price);
    // We could add similar validation for the price if needed

    const totalQuoteAmount = amountDecimal.times(priceDecimal);

    const newTrade = this.tradeRepository.create({
      buyer,
      seller,
      baseAsset: baseAsset.symbol,
      quoteAsset: quoteAsset.symbol,
      amount: amountDecimal,
      price: priceDecimal,
      totalQuoteAmount,
      feeAsset: quoteAsset.symbol,
      feeAmount: totalQuoteAmount.times('0.001'),
      status: TradeStatus.PENDING,
    });

    return this.tradeRepository.save(newTrade);
  }

async processOnChainSettlement(tradeId: string): Promise<Trade> {
    // Use a database transaction to ensure atomicity
    return this.entityManager.transaction('SERIALIZABLE', async (transactionalEntityManager) => {
        const tradeRepo = transactionalEntityManager.getRepository(Trade);
        
        // Fetch the trade with a pessimistic write lock to prevent race conditions
        const trade = await tradeRepo.findOne({
            where: { id: tradeId },
            lock: { mode: 'pessimistic_write' },
        });

        if (!trade) throw new NotFoundException('Trade not found during settlement.');
        if (trade.status !== TradeStatus.PENDING) {
            throw new ConflictException(`Trade is not in PENDING state. Current state: ${trade.status}`);
        }

        // 1. Update status to SETTLING immediately to prevent other workers from picking it up
        trade.status = TradeStatus.SETTLING;
        await tradeRepo.save(trade);
        
        this.logger.log(`Trade ${tradeId} locked and marked as SETTLING.`);

        // 2. Perform the on-chain logic. This is the part that can take time.
        // In a real system, we'd use a WalletService to sign transactions.
        const txHash = await this.blockchainService.broadcastSettlement(trade);

        // 3. Mark the trade as SETTLED and save the transaction hash
        // In a real system, we'd commit the hold from the LedgerService here.
        trade.status = TradeStatus.SETTLED;
        trade.settledAt = new Date();
        trade.onChainTxHash = txHash;
        const updatedTrade = await tradeRepo.save(trade);
        if(!updatedTrade) {
          throw new ConflictException('Failed to update trade status to SETTLED.');
        }
        this.logger.log(`Trade ${tradeId} settled successfully. TxHash: ${txHash}`);
        return updatedTrade;
    });
}

  async markAsFailed(tradeId: string, reason: string): Promise<void> {
    const trade = await this.tradeRepository.findOneBy({ id: tradeId });
    if (trade && trade.status === TradeStatus.SETTLING) {
      // In a real system, we would release the hold in the LedgerService here.
      trade.status = TradeStatus.FAILED;
      trade.failureReason = reason.substring(0, 255); // Truncate to fit schema
      await this.tradeRepository.save(trade);
    }
  }

  async markAsCancelled(tradeId: string): Promise<void> {
    const trade = await this.tradeRepository.findOneBy({ id: tradeId });
    if (trade && trade.status === TradeStatus.PENDING) {
      // In a real system, we would release the hold in the LedgerService here.
      trade.status = TradeStatus.CANCELED;
      await this.tradeRepository.save(trade);
    } else {
      throw new ConflictException(`Trade is not in PENDING state. Current state: ${trade.status}`);
    }
  }

  async findAll(status?: TradeStatus): Promise<Trade[]> {
    return this.tradeRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Trade> {
    const trade = await this.tradeRepository.findOneBy({ id });
    if (!trade) {
      throw new NotFoundException(`Trade with ID ${id} not found`);
    }
    return trade;
  }
}