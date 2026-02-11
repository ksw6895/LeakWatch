import { Controller, Get } from '@nestjs/common';

import { AuthContext } from './auth.decorators';
import type { RequestAuthContext } from './auth.types';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@AuthContext() auth: RequestAuthContext) {
    return auth;
  }
}
