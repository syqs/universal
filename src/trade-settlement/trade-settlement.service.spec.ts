import { Test, TestingModule } from '@nestjs/testing';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

import { TradeSettlementService } from './trade-settlement.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { TradeStatus } from './interfaces/trade-status.enum';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { SettleTradeDto } from './dto/settle-trade.dto';
import { Repository, EntityManager } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Trade } from './entities/trade.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { mockBlockchainService } from '../blockchain/mock-blockchain.service';

type MockType<T> = {
  [P in keyof T]?: jest.Mock<{}>;
};

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  processOnChainSettlement: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
});


describe('TradeSettlementService', () => {
  let service: TradeSettlementService;
  let repository: jest.Mocked<Repository<Trade>>;

  let entityManagerMock: any;
  beforeEach(async () => {
    entityManagerMock = {
      transaction: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeSettlementService,
        {
          provide: getRepositoryToken(Trade),
          useFactory: mockRepository,
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: EntityManager,
          useValue: entityManagerMock,
        },
      ],
    }).compile();

    service = module.get<TradeSettlementService>(TradeSettlementService);
    repository = module.get(getRepositoryToken(Trade)) as jest.Mocked<Repository<Trade>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });


  describe('create', () => {
    it('should create and return a new trade with PENDING status', async () => {
      const createTradeDto: any = {
        buyer: 'user1',
        seller: 'user2',
        baseAsset: 'uBTC',
        quoteAsset: 'uUSD',
        amount: '0.5',
        price: '65000.50',
      };
      const expectedTrade = {
        id: 'some-id',
        buyer: 'user1',
        seller: 'user2',
        baseAsset: 'uBTC',
        quoteAsset: 'uUSD',
        amount: new Decimal('0.5'),
        price: new Decimal('65000.50'),
        totalQuoteAmount: new Decimal('32500.25'),
        feeAmount: new Decimal('32.50'),
        feeAsset: 'uUSD',
        status: TradeStatus.PENDING,
        createdAt: expect.any(Date),
      };
      repository.create.mockReturnValue(expectedTrade);
      repository.save.mockResolvedValue(expectedTrade);

      const result = await service.create(createTradeDto);

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        buyer: 'user1',
        seller: 'user2',
        baseAsset: 'uBTC',
        quoteAsset: 'uUSD',
        amount: expect.anything(),
        price: expect.anything(),
        totalQuoteAmount: expect.anything(),
        feeAmount: expect.anything(),
        feeAsset: 'uUSD',
        status: TradeStatus.PENDING,
      }));
      expect(repository.save).toHaveBeenCalledWith(expectedTrade);
      expect(result).toEqual(expectedTrade);
    });
  });


  describe('settle', () => {
    it('should settle a trade successfully', async () => {
      const tradeId = uuidv4();
      // Use a single trade object reference to match mutation in service
      const tradeObj = { id: tradeId, status: TradeStatus.PENDING } as Trade;
      const saveArgs: any[] = [];
      const saveMock = jest.fn().mockImplementation((trade) => {
        // Deep clone the trade object at the time of save
        saveArgs.push(JSON.parse(JSON.stringify(trade)));
        return Promise.resolve(trade);
      });
      const transactionalRepo = {
        findOne: jest.fn().mockResolvedValue(tradeObj),
        save: saveMock,
      };
      const transactionalEntityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepo),
      };
      mockBlockchainService.broadcastSettlement.mockResolvedValue('0xabc');
      entityManagerMock.transaction.mockImplementation(async (_isoLevel, cb) => cb(transactionalEntityManager));

      const result = await service.processOnChainSettlement(tradeId);

      expect(transactionalRepo.findOne).toHaveBeenCalledWith({ where: { id: tradeId }, lock: { mode: 'pessimistic_write' } });
      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveArgs[0].id).toBe(tradeId);
      expect(saveArgs[0].status).toBe(TradeStatus.SETTLING);
      expect(saveArgs[1].id).toBe(tradeId);
      expect(saveArgs[1].status).toBe(TradeStatus.SETTLED);
      expect(mockBlockchainService.broadcastSettlement).toHaveBeenCalledWith(tradeObj);
      expect(result.status).toBe(TradeStatus.SETTLED);
      expect(result.onChainTxHash).toBe('0xabc');
    });

    it('should throw NotFoundException if trade does not exist', async () => {
      const tradeId = 'non-existent-id';
      const transactionalRepo = {
        findOne: jest.fn().mockResolvedValue(undefined),
        save: jest.fn(),
      };
      const transactionalEntityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepo),
      };
      entityManagerMock.transaction.mockImplementation(async (_isoLevel, cb) => cb(transactionalEntityManager));

      await expect(service.processOnChainSettlement(tradeId)).rejects.toThrow(NotFoundException);
      expect(transactionalRepo.findOne).toHaveBeenCalledWith({ where: { id: tradeId }, lock: { mode: 'pessimistic_write' } });
    });
  });

  describe('findOne', () => {
    it('should return a trade if found', async () => {
      const tradeId = 'test-id';
      const trade = {
        id: tradeId,
        buyer: 'user1',
        seller: 'user2',
        baseAsset: 'uBTC',
        quoteAsset: 'uUSD',
        amount: new Decimal('0.5'),
        price: new Decimal('65000.50'),
        totalQuoteAmount: new Decimal('32500.25'),
        feeAmount: new Decimal('32.50'),
        feeAsset: 'uUSD',
        status: TradeStatus.PENDING,
        createdAt: expect.any(Date),
      };
      repository.findOneBy.mockResolvedValue(trade);

      const result = await service.findOne(tradeId);

      expect(result).toEqual(trade);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: tradeId });
    });

    it('should throw NotFoundException if trade is not found', async () => {
      const tradeId = 'not-found-id';
      repository.findOneBy.mockResolvedValue(undefined);

      await expect(service.findOne(tradeId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsFailed', () => {
    it('should mark a SETTLING trade as FAILED and set failureReason', async () => {
      const tradeId = uuidv4();
      const trade = { id: tradeId, status: TradeStatus.SETTLING } as Trade;
      repository.findOneBy.mockResolvedValue(trade);
      repository.save.mockResolvedValue({ ...trade, status: TradeStatus.FAILED, failureReason: 'fail' });

      await service.markAsFailed(tradeId, 'fail');

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: tradeId });
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: tradeId, status: TradeStatus.FAILED, failureReason: 'fail' }));
    });

    it('should do nothing if trade is not SETTLING', async () => {
      const tradeId = uuidv4();
      const trade = { id: tradeId, status: TradeStatus.PENDING } as Trade;
      repository.findOneBy.mockResolvedValue(trade);

      await service.markAsFailed(tradeId, 'fail');

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('markAsCancelled', () => {
    it('should mark a PENDING trade as CANCELED', async () => {
      const tradeId = uuidv4();
      const trade = { id: tradeId, status: TradeStatus.PENDING } as Trade;
      repository.findOneBy.mockResolvedValue(trade);
      repository.save.mockResolvedValue({ ...trade, status: TradeStatus.CANCELED });

      await service.markAsCancelled(tradeId);

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: tradeId });
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: tradeId, status: TradeStatus.CANCELED }));
    });

    it('should throw ConflictException if trade is not PENDING', async () => {
      const tradeId = uuidv4();
      const trade = { id: tradeId, status: TradeStatus.SETTLING } as Trade;
      repository.findOneBy.mockResolvedValue(trade);

      await expect(service.markAsCancelled(tradeId)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all trades if no status is provided', async () => {
      const trades = [
        { id: '1', status: TradeStatus.PENDING } as Trade,
        { id: '2', status: TradeStatus.SETTLED } as Trade,
      ];
      repository.find.mockResolvedValue(trades);

      const result = await service.findAll();
      expect(repository.find).toHaveBeenCalledWith({ where: {}, order: { createdAt: 'DESC' } });
      expect(result).toEqual(trades);
    });

    it('should filter trades by status', async () => {
      const trades = [
        { id: '1', status: TradeStatus.PENDING } as Trade,
      ];
      repository.find.mockResolvedValue(trades);

      const result = await service.findAll(TradeStatus.PENDING);
      expect(repository.find).toHaveBeenCalledWith({ where: { status: TradeStatus.PENDING }, order: { createdAt: 'DESC' } });
      expect(result).toEqual(trades);
    });
  });
});