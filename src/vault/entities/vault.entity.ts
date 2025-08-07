import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity()
export class Vault {
  @PrimaryColumn() // The user's main wallet address is the primary key
  @Index()
  ownerAddress: string;

  @Column({ nullable: true })
  delegatedSessionKey?: string;

  @Column({ type: 'datetime', nullable: true })
  delegationExpiresAt?: Date;
}