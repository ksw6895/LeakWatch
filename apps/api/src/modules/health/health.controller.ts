import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/auth.decorators';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}
