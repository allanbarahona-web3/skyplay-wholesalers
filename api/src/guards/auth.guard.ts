// src/guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { Pool } from 'pg';

export interface JWTPayload {
  id: number;
  tenant_id: number | null;
  role: string;
  jti?: string;  // JWT ID - para revocación de tokens
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      // Validar que el token no esté revocado
      if (payload.jti) {
        const result = await this.pg.query(
          'SELECT id FROM revoked_tokens WHERE jti = $1',
          [payload.jti]
        );
        
        if (result.rows.length > 0) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }
      
      // Agregar payload al request para uso posterior
      (request as any).user = payload;
      
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
