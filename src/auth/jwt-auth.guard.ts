import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * This guard uses the 'jwt' strategy we defined in jwt.strategy.ts.
 * Applying this guard to an endpoint will protect it by requiring a valid
 * Bearer JWT in the Authorization header.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}