import { Controller, Get, Post, Body, Param, Query, UseInterceptors, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { TradeSettlementService } from './trade-settlement.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { SettleTradeDto } from './dto/settle-trade.dto';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { Trade } from './entities/trade.entity';
import { TradeStatus } from './interfaces/trade-status.enum';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@ApiTags('trades')
@Controller('trades')
@UseInterceptors(LoggingInterceptor)
export class TradeSettlementController {
  constructor(
    private readonly tradeSettlementService: TradeSettlementService,
    @InjectQueue('settlement') private readonly settlementQueue: Queue,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Initiate a new trade',
    description: 'Creates a new trade record in a PENDING state. In a real system, this would also place a hold on the seller\'s funds.',
  })
  @ApiResponse({ status: 201, description: 'The trade has been successfully initiated.', type: Trade })
  @ApiResponse({ status: 400, description: 'Bad Request. Input data is invalid.' })
  create(@Body() createTradeDto: CreateTradeDto): Promise<Trade> {
    return this.tradeSettlementService.create(createTradeDto);
  }

  @Post('/settle')
  @HttpCode(202) // Use 202 Accepted
  @ApiOperation({
    summary: 'Queue a pending trade for settlement',
    description: 'Accepts a settlement request and adds it to a background processing queue. The actual settlement happens asynchronously.',
  })
  @ApiResponse({ status: 202, description: 'The settlement request has been accepted for processing.' })
  @ApiResponse({ status: 404, description: 'Trade not found for the given tradeId.' })
  async settle(@Body() settleTradeDto: SettleTradeDto): Promise<{ message: string }> {
    // Ensure the trade exists before queueing
    await this.tradeSettlementService.findOne(settleTradeDto.tradeId);

    await this.settlementQueue.add('settle-trade', {
      tradeId: settleTradeDto.tradeId,
    });

    return { message: 'Settlement request accepted and is being processed.' };
  }

  @Get()
  @ApiOperation({ summary: 'List all trades with optional filtering' })
  @ApiQuery({ name: 'status', enum: TradeStatus, required: false })
  @ApiResponse({ status: 200, description: 'An array of trades.', type: [Trade] })
  findAll(@Query('status') status?: TradeStatus): Promise<Trade[]> {
    return this.tradeSettlementService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific trade by its ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'The details of the trade.', type: Trade })
  @ApiResponse({ status: 404, description: 'Trade not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Trade> {
    return this.tradeSettlementService.findOne(id);
  }
}