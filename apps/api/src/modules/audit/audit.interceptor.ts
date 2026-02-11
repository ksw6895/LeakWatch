import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import type { RequestWithAuth } from '../auth/auth.types';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithAuth>();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.auditService.recordWriteRequest(req).catch((error) => {
            // Audit logging failures must not break successful API responses.
            // eslint-disable-next-line no-console
            console.error('audit_write_failed', error);
          });
        },
      }),
    );
  }
}
