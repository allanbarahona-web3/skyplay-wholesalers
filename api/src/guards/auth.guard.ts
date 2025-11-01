// src/guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

export interface JWTPayload {
  id: number;
  tenant_id: number | null;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      // Agregar payload al request para uso posterior
      (request as any).user = payload;
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
