import { Controller, Post, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('delegate/initiate')
  @ApiOperation({ summary: 'Initiate delegation', description: 'Starts the delegation process by generating a challenge for the user to sign.' })
  @ApiBody({
    description: 'The owner address of the user',
    type: Object,
    examples: {
      example1: {
        summary: 'Example request',
        value: { ownerAddress: '0x1234567890abcdef' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Delegation initiated successfully.', schema: { example: { challenge: 'delegate-session-1722979192000' } } })
  initiate(@Body() body: { ownerAddress?: string }) {
    if (!body || !body.ownerAddress) {
      throw new Error('ownerAddress is required in body');
    }
    return this.authService.initiateDelegation(body.ownerAddress);
  }

  @Post('delegate/confirm')
  @ApiOperation({ summary: 'Confirm delegation', description: 'Confirms delegation by verifying the user signature and issuing a JWT.' })
  @ApiBody({
    description: 'The owner address, signature, and challenge',
    type: Object,
    examples: {
      example1: {
        summary: 'Example request',
        value: {
          ownerAddress: '0x1234567890abcdef',
          signature: 'signed-by-0x1234567890abcdef-for-challenge-delegate-session-1722979192000',
          challenge: 'delegate-session-1722979192000',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Delegation confirmed successfully.', schema: { example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } } })
  confirm(@Body() body: { ownerAddress?: string; signature?: string; challenge?: string }) {
    if (!body || !body.ownerAddress || !body.signature || !body.challenge) {
      throw new Error('ownerAddress, signature, and challenge are required in body');
    }
    return this.authService.confirmDelegation(body.ownerAddress, body.signature, body.challenge);
  }
  
  @UseGuards(JwtAuthGuard)
  @Post('revoke')
  @ApiOperation({ summary: 'Revoke delegation', description: 'Revokes the current session delegation for the authenticated user.' })
  @ApiResponse({ status: 204, description: 'Delegation revoked successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Invalid or expired JWT.' })
  @HttpCode(204)
  async revoke(@Request() req) {
    await this.authService.revokeDelegation(req.user.sub);
  }
}