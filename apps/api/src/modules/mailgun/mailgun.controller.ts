import { Body, Controller, Inject, Post } from '@nestjs/common';

import { Public } from '../auth/auth.decorators';
import { MailgunService } from './mailgun.service';

@Controller('mailgun/webhooks')
export class MailgunController {
  constructor(@Inject(MailgunService) private readonly mailgunService: MailgunService) {}

  @Public()
  @Post('events')
  events(@Body() body: Record<string, unknown>) {
    return this.mailgunService.handleWebhook(body);
  }
}
