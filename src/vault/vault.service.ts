import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vault } from './entities/vault.entity';

@Injectable()
export class VaultService {
  constructor(
    @InjectRepository(Vault)
    private readonly vaultRepository: Repository<Vault>,
  ) {}

  /**
   * Finds a vault by owner address.
   */
  async findOne(ownerAddress: string): Promise<Vault | null> {
    return this.vaultRepository.findOneBy({ ownerAddress });
  }

  /**
   * Finds a vault or creates one if it doesn't exist.
   * This is called when a user initiates a new delegation session.
   */
  async findOrCreate(ownerAddress: string): Promise<Vault> {
    let vault = await this.findOne(ownerAddress);
    if (!vault) {
      vault = this.vaultRepository.create({ ownerAddress });
      await this.vaultRepository.save(vault);
    }
    return vault;
  }

  /**
   * Associates a new session key with the user's vault and sets its expiration.
   */
  async updateDelegation(ownerAddress: string, sessionKey: string): Promise<Vault> {
    const vault = await this.findOrCreate(ownerAddress);

    vault.delegatedSessionKey = sessionKey;
    // Set expiration to 24 hours from now
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);
    vault.delegationExpiresAt = expiration;

    return this.vaultRepository.save(vault);
  }

  /**
   * Clears the session key from the user's vault, effectively logging them out.
   */
  async clearDelegation(ownerAddress: string): Promise<void> {
    const vault = await this.findOne(ownerAddress);
    if (vault) {
      vault.delegatedSessionKey = null;
      vault.delegationExpiresAt = null;
      await this.vaultRepository.save(vault);
    }
  }
}