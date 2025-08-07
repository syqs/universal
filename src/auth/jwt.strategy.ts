import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'a-very-secret-key-for-dev'),
    });
  }

  async validate(payload: any) {
    // The payload is what we signed in the AuthService.
    // It is automatically attached to the request object as `req.user`.
    return { sub: payload.sub, sessionKey: payload.sessionKey };
  }
}