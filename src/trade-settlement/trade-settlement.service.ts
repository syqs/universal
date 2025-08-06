import { Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CreateTradeDto } from './dto/create-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeStatus } from './interfaces/trade-status.enum';
import Decimal from 'decimal.js';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class TradeSettlementService {
  private readonly logger = new Logger(TradeSettlementService.name);

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly blockchainService: BlockchainService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(createTradeDto: CreateTradeDto): Promise<Trade> {
    // In a real system, we would first call a LedgerService to place a hold on the seller's funds.
    // e.g., await this.ledgerService.placeHold({ userId: seller, asset: baseAsset, amount });
    
    const { buyer, seller, baseAsset, quoteAsset, amount, price } = createTradeDto;
    const amountDecimal = new Decimal(amount);
    const priceDecimal = new Decimal(price);
    const totalQuoteAmount = amountDecimal.times(priceDecimal);

    const newTrade = this.tradeRepository.create({
      buyer, seller, baseAsset, quoteAsset,
      amount: amountDecimal,
      price: priceDecimal,
      totalQuoteAmount,
      feeAsset: quoteAsset,
      feeAmount: totalQuoteAmount.times('0.001'), // Example 0.1% fee
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