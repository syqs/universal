import { Controller, Get, Post, Body, Param, Query, UseInterceptors, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { TradeSettlementService } from './trade-settlement.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { SettleTradeDto } from './dto/settle-trade.dto';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { Trade } from './entities/trade.entity';
import { TradeStatus } from './interfaces/trade-status.enum';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('trades')
@ApiBearerAuth() 
@Controller('trades')
@UseInterceptors(LoggingInterceptor)
export class TradeSettlementController {
  constructor(
    private readonly tradeSettlementService: TradeSettlementService,
    @InjectQueue('settlement') private readonly settlementQueue: Queue,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Initiate a new trade (requires JWT Bearer token in Authorization header)' })
  @ApiBearerAuth('JWT')
  @ApiResponse({ status: 201, description: 'The trade has been successfully initiated.', type: Trade })
  @ApiResponse({ status: 400, description: 'Bad Request. Input data is invalid.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. JWT required.' })
  @ApiBody({
    type: CreateTradeDto,
    examples: {
      default: {
        summary: 'Example trade',
        value: {
          buyer: 'user_wallet_buyer_123',
          seller: 'user_wallet_seller_456',
          baseAsset: 'uBTC',
          quoteAsset: 'uUSD',
          amount: '1.5',
          price: '50000.75',
        },
      },
    },
  })
  async create(
    @Body() createTradeDto: CreateTradeDto,
    @Request() req,
  ): Promise<Trade> {
    // req.user is set by JwtStrategy
    return this.tradeSettlementService.create(createTradeDto, req.user);
  }

  @Post('/settle')
  @UseGuards(JwtAuthGuard)
  @HttpCode(202)
  @ApiOperation({ summary: 'Queue a pending trade for settlement (requires JWT Bearer token)' })
  @ApiBearerAuth('JWT')
  @ApiResponse({ status: 202, description: 'The settlement request has been accepted for processing.' })
  @ApiResponse({ status: 404, description: 'Trade not found for the given tradeId.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. JWT required.' })
  @ApiBody({
    type: SettleTradeDto,
    examples: {
      default: {
        summary: 'Settle trade example',
        value: {
          tradeId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        },
      },
    },
  })
  async settle(@Body() settleTradeDto: SettleTradeDto, @Request() req): Promise<{ message: string }> {
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