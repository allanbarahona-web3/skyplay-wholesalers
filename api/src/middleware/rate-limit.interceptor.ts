import { UseInterceptors, applyDecorators } from '@nestjs/common';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { loginRateLimiter, strictRateLimiter, generalRateLimiter } from './rate-limit.middleware';

/**
 * Interceptor para aplicar rate limiting de login
 */
@Injectable()
export class LoginRateLimitInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    return new Observable((observer) => {
      loginRateLimiter(request, response, (err?: any) => {
        if (err) {
          observer.error(err);
        } else {
          next.handle().subscribe({
            next: (data) => observer.next(data),
            error: (error) => observer.error(error),
            complete: () => observer.complete(),
          });
        }
      });
    });
  }
}

/**
 * Interceptor para rate limiting estricto
 */
@Injectable()
export class StrictRateLimitInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    return new Observable((observer) => {
      strictRateLimiter(request, response, (err?: any) => {
        if (err) {
          observer.error(err);
        } else {
          next.handle().subscribe({
            next: (data) => observer.next(data),
            error: (error) => observer.error(error),
            complete: () => observer.complete(),
          });
        }
      });
    });
  }
}

/**
 * Decorador para aplicar rate limiting de login
 */
export const UseLoginRateLimit = () => UseInterceptors(LoginRateLimitInterceptor);

/**
 * Decorador para aplicar rate limiting estricto
 */
export const UseStrictRateLimit = () => UseInterceptors(StrictRateLimitInterceptor);
