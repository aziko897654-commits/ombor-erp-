import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

/** Wraps successful responses into { data, meta? } (section 6.4). */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((result) => {
        if (result instanceof StreamableFile) return result;
        if (
          result &&
          typeof result === 'object' &&
          'data' in result &&
          ('meta' in result || Object.keys(result).length === 1)
        ) {
          return result;
        }
        return { data: result ?? null };
      }),
    );
  }
}
