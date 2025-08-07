import { Controller, Post, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('delegate/initiate')
  @ApiOperation({ summary: 'Initiate delegation' })
  @ApiResponse({ status: 200, description: 'Delegation initiated successfully.' })
  initiate(@Body() body: { ownerAddress: string }) {
    return this.authService.initiateDelegation(body.ownerAddress);
  }

  @Post('delegate/confirm')
  @ApiOperation({ summary: 'Confirm delegation' })
  @ApiResponse({ status: 200, description: 'Delegation confirmed successfully.' })
  confirm(@Body() body: { ownerAddress: string; signature: string; challenge: string }) {
    return this.authService.confirmDelegation(body.ownerAddress, body.signature, body.challenge);
  }
  
  @UseGuards(JwtAuthGuard)
  @Post('revoke')
  @ApiOperation({ summary: 'Revoke delegation' })
  @ApiResponse({ status: 204, description: 'Delegation revoked successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Invalid or expired JWT.' })
  @HttpCode(204)
  async revoke(@Request() req) {
    await this.authService.revokeDelegation(req.user.sub);
  }
}