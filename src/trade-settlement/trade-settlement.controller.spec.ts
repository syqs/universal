import { Test, TestingModule } from '@nestjs/testing';
import { TradeSettlementController } from './trade-settlement.controller';
import { TradeSettlementService } from './trade-settlement.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { SettleTradeDto } from './dto/settle-trade.dto';
import { TradeStatus } from './interfaces/trade-status.enum';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { getQueueToken } from '@nestjs/bull';
import Decimal from 'decimal.js';
import { AssetRegistryService } from '../asset-registry/asset-registry.service';

const mockTradeService = {
  create: jest.fn(),
  processOnChainSettlement: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getHealth: jest.fn(),
} as unknown as jest.Mocked<TradeSettlementService>;

const mockAssetRegistryService = {
  findTradableAssetBySymbol: jest.fn(),
};
const mockSettlementQueue = { add: jest.fn() };

describe('TradeSettlementController', () => {
  let controller: TradeSettlementController;
  let service: jest.Mocked<TradeSettlementService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradeSettlementController],
      providers: [
        {
          provide: TradeSettlementService,
          useValue: mockTradeService,
        },
        {
          provide: getQueueToken('settlement'),
          useValue: mockSettlementQueue,
        },
        {
          provide: AssetRegistryService,
          useValue: { findTradableAssetBySymbol: jest.fn() },
        },
      ],
    })
      .overrideInterceptor(LoggingInterceptor)
      .useValue({})
      .compile();

    controller = module.get<TradeSettlementController>(TradeSettlementController);
    service = module.get<TradeSettlementService>(TradeSettlementService) as jest.Mocked<TradeSettlementService>;
  });

   afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('settle', () => {
    it('should call the service to settle a trade (queue-based)', async () => {
      const settleTradeDto: SettleTradeDto = { tradeId: '1' };
      service.findOne.mockResolvedValue({ id: '1' } as any);
      mockSettlementQueue.add.mockResolvedValue(undefined);

      const result = await controller.settle(settleTradeDto);

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(mockSettlementQueue.add).toHaveBeenCalledWith('settle-trade', { tradeId: '1' });
      expect(result).toEqual({ message: 'Settlement request accepted and is being processed.' });
    });

    it('should throw if trade is not found', async () => {
      const settleTradeDto: SettleTradeDto = { tradeId: 'notfound' };
      service.findOne.mockRejectedValue(new Error('Not found'));
      await expect(controller.settle(settleTradeDto)).rejects.toThrow('Not found');
      expect(service.findOne).toHaveBeenCalledWith('notfound');
      expect(mockSettlementQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should call the service to find all trades', async () => {
      const trades = [
        {
          id: '1',
          buyer: 'b1',
          seller: 's1',
          baseAsset: 'uETH',
          quoteAsset: 'uUSD',
          amount: new Decimal('1.0'),
          price: new Decimal('50000.00'),
          totalQuoteAmount: new Decimal('50000.00'),
          feeAmount: new Decimal('50.00'),
          feeAsset: 'uUSD',
          status: TradeStatus.PENDING,
          createdAt: new Date(),
        },
        {
          id: '2',
          buyer: 'b2',
          seller: 's2',
          baseAsset: 'uBTC',
          quoteAsset: 'uUSD',
          amount: new Decimal('2.0'),
          price: new Decimal('60000.00'),
          totalQuoteAmount: new Decimal('120000.00'),
          feeAmount: new Decimal('120.00'),
          feeAsset: 'uUSD',
          status: TradeStatus.PENDING,
          createdAt: new Date(),
        },
      ];
      mockTradeService.findAll.mockResolvedValue(trades);
      
      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(trades);
    });

    it('should call the service to find trades by status', async () => {
      const trades = [
        {
          id: '1',
          buyer: 'b1',
          seller: 's1',
          baseAsset: 'uETH',
          quoteAsset: 'uUSD',
          amount: new Decimal('1.0'),
          price: new Decimal('50000.00'),
          totalQuoteAmount: new Decimal('50000.00'),
          feeAmount: new Decimal('50.00'),
          feeAsset: 'uUSD',
          status: TradeStatus.PENDING,
          createdAt: new Date(),
        },
      ];
      mockTradeService.findAll.mockResolvedValue(trades);
      const result = await controller.findAll(TradeStatus.PENDING);
      expect(service.findAll).toHaveBeenCalledWith(TradeStatus.PENDING);
      expect(result).toEqual(trades);
    });
  });

  describe('findOne', () => {
    it('should call the service to find a trade by id', async () => {
      const trade = {
        id: '1',
        buyer: 'b1',
        seller: 's1',
        baseAsset: 'uETH',
        quoteAsset: 'uUSD',
        amount: new Decimal('1.0'),
        price: new Decimal('50000.00'),
        totalQuoteAmount: new Decimal('50000.00'),
        feeAmount: new Decimal('50.00'),
        feeAsset: 'uUSD',
        status: TradeStatus.PENDING,
        createdAt: new Date(),
      };
      mockTradeService.findOne.mockResolvedValue(trade);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(trade);
    });

    it('should throw if trade is not found', async () => {
      mockTradeService.findOne.mockRejectedValue(new Error('Not found'));
      await expect(controller.findOne('notfound')).rejects.toThrow('Not found');
      expect(service.findOne).toHaveBeenCalledWith('notfound');
    });
  });
  describe('create', () => {
    it('should call the service to create a trade', async () => {
      const dto: CreateTradeDto = {
        buyer: 'b1',
        seller: 's1',
        baseAsset: 'uETH',
        quoteAsset: 'uUSD',
        amount: '1.0',
        price: '50000.00',
      };
      const trade = { id: '1', ...dto } as any;
      mockTradeService.create.mockResolvedValue(trade);
      const mockReq = { user: { id: 'user1', roles: ['trader'] } };
      const result = await controller.create(dto, mockReq);
      // The controller passes req.user to service.create, so the expectation should match
      expect(service.create).toHaveBeenCalledWith(dto, mockReq.user);
      expect(result).toEqual(trade);
    });

    it('should throw if service.create throws', async () => {
      const dto: CreateTradeDto = {
        buyer: 'b1',
        seller: 's1',
        baseAsset: 'uETH',
        quoteAsset: 'uUSD',
        amount: '1.0',
        price: '50000.00',
      };
      mockTradeService.create.mockRejectedValue(new Error('fail'));
      const mockReq = { user: { id: 'user1', roles: ['trader'] } };
      await expect(controller.create(dto, mockReq)).rejects.toThrow('fail');
      // The controller passes req.user to service.create, so the expectation should match
      expect(service.create).toHaveBeenCalledWith(dto, mockReq.user);
    });
  });
});