import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { VaultService } from '../vault/vault.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly vaultService: VaultService,
    private readonly cryptoService: CryptoService,
    private readonly jwtService: JwtService,
  ) {}

  async initiateDelegation(ownerAddress: string): Promise<{ challenge: string }> {
    // Ensure the vault exists for this user, or create it.
    await this.vaultService.findOrCreate(ownerAddress);
    // The challenge is what the user must sign.
    const challenge = `delegate-session-${Date.now()}`;
    return { challenge };
  }

  async confirmDelegation(
    ownerAddress: string,
    signature: string,
    challenge: string,
  ): Promise<{ accessToken: string }> {
    const isValid = await this.cryptoService.verifySignature(ownerAddress, signature, challenge);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature.');
    }

    // Signature is valid, generate a new session key and delegate it.
    const sessionKey = this.cryptoService.generateSessionKey();
    await this.vaultService.updateDelegation(ownerAddress, sessionKey.publicKey);

    // Create the JWT payload
    const payload = { sub: ownerAddress, sessionKey: sessionKey.publicKey };
    const accessToken = this.jwtService.sign(payload);
    
    return { accessToken };
  }
  
  async revokeDelegation(ownerAddress: string): Promise<void> {
    await this.vaultService.clearDelegation(ownerAddress);
  }
}