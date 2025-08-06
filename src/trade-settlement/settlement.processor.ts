import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { TradeSettlementService } from './trade-settlement.service';
/**
 * SettlementProcessor is responsible for processing settlement jobs from the 'settlement' queue.
 * It handles the on-chain settlement of trades and logs the process.
 */
@Processor('settlement')
export class SettlementProcessor {
  private readonly logger = new Logger(SettlementProcessor.name);

  constructor(private readonly tradeSettlementService: TradeSettlementService) {}

  @Process('settle-trade')
  async handleSettlement(job: Job<{ tradeId: string }>) {
    const { tradeId } = job.data;
    this.logger.log(`Starting settlement process for trade: ${tradeId}`);

    try {
      await this.tradeSettlementService.processOnChainSettlement(tradeId);
      this.logger.log(`Successfully completed settlement for trade: ${tradeId}`);
    } catch (error) {
      this.logger.error(
        `Settlement failed for trade ${tradeId}: ${error.message}`,
        error.stack,
      );
      // Mark the trade as failed in the database
      await this.tradeSettlementService.markAsFailed(tradeId, error.message);
    }
  }
}