import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vault } from './entities/vault.entity';
import { VaultService } from './vault.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vault])],
  providers: [VaultService],
  exports: [VaultService], 
})
export class VaultModule {}