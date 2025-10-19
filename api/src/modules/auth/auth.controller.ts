// src/modules/auth/auth.controller.ts
import { Controller, Get, Post, Body, Res, Req, HttpException, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';


type JWTPayload = { id: number; tenant_id: number|null; role: string };

@Controller('auth')
export class AuthController {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}

  @Post('login-otp')
async login(@Body() body: any, @Res() res: Response) {
  const { email, password, otp } = body || {};
  
  if (!email || !password || !otp) {
    throw new HttpException('Email, password y OTP son requeridos', 400);
  }

  // Buscar usuario
  const q = `SELECT id, email, password_hash, totp_secret, totp_enabled, tenant_id, role, is_active FROM users WHERE email = $1 LIMIT 1`;
  const { rows } = await this.pg.query(q, [email]);
  const u = rows[0];

  if (!u || u.is_active === false) {
    throw new HttpException('Usuario no encontrado o inactivo', 401);
  }

  // Validar password
  const isValidPassword = await bcrypt.compare(password, u.password_hash);
  if (!isValidPassword) {
    throw new HttpException('Credenciales inválidas', 401);
  }

  // Validar TOTP
  if (!u.totp_secret) {
    throw new HttpException('Debes configurar Google Authenticator primero', 401);
  }

  const { authenticator } = await import('otplib');
  const isValidOtp = authenticator.verify({ token: otp, secret: u.totp_secret });
  
  if (!isValidOtp) {
    throw new HttpException('Código TOTP inválido o expirado', 401);
  }

  // Activar TOTP si es la primera vez que lo usa correctamente
  if (!u.totp_enabled) {
    await this.pg.query('UPDATE users SET totp_enabled = true WHERE id = $1', [u.id]);
  }

  // Generar JWT
  const payload: JWTPayload = { 
    id: Number(u.id), 
    tenant_id: u.tenant_id ?? null, 
    role: u.role 
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });

  // Setear cookie
  res.cookie(process.env.SESSION_COOKIE_NAME || 'sky_sid', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ 
    ok: true, 
    user: { 
      id: u.id, 
      email: u.email, 
      tenant_id: u.tenant_id, 
      role: u.role 
    } 
  });
}

  @Post('setup-totp')
async setupTotp(@Body() body: any, @Res() res: Response) {
  const { email } = body;
  if (!email) throw new HttpException('Email requerido', 400);

  // Buscar usuario
  const { rows } = await this.pg.query(
    'SELECT id, email, totp_secret FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) throw new HttpException('Usuario no encontrado', 404);

  // Generar secret si no existe
  let secret = user.totp_secret;
  if (!secret) {
    const { authenticator } = await import('otplib');
    secret = authenticator.generateSecret();
    await this.pg.query(
      'UPDATE users SET totp_secret = $1 WHERE id = $2',
      [secret, user.id]
    );
  }

  // Generar QR code
  const { authenticator } = await import('otplib');
  const QRCode = await import('qrcode');
  const otpauth = authenticator.keyuri(user.email, 'Skyplay Mayoristas', secret);
  const qrcode = await QRCode.toDataURL(otpauth);

  return res.json({ qrcode, secret });
}

@Post('reset-password-totp')
async resetPasswordTotp(@Body() body: any) {
  const { email, totp, newPassword } = body;

  if (!email || !totp || !newPassword) {
    throw new HttpException('Email, TOTP y nueva contraseña son requeridos', 400);
  }

  if (newPassword.length < 8) {
    throw new HttpException('La contraseña debe tener al menos 8 caracteres', 400);
  }

  // Buscar usuario
  const { rows } = await this.pg.query(
    'SELECT id, email, totp_secret FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];

  if (!user) {
    throw new HttpException('Usuario no encontrado', 404);
  }

  if (!user.totp_secret) {
    throw new HttpException('Este usuario no tiene Google Authenticator configurado', 400);
  }

  // Validar TOTP
  const { authenticator } = await import('otplib');
  const isValidOtp = authenticator.verify({ token: totp, secret: user.totp_secret });

  if (!isValidOtp) {
    throw new HttpException('Código TOTP inválido o expirado', 401);
  }

  // Hash de la nueva contraseña
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Actualizar contraseña
  await this.pg.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [newPasswordHash, user.id]
  );

  return { ok: true, message: 'Contraseña actualizada correctamente' };
}
  @Get('me')
  async me(@Req() req: Request) {
    const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
    if (!raw) throw new HttpException('Unauthorized', 401);
    try {
      const payload = jwt.verify(raw, process.env.JWT_SECRET!) as JWTPayload;
      return payload;
    } catch {
      throw new HttpException('Unauthorized', 401);
    }
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie(process.env.SESSION_COOKIE_NAME || 'sky_sid', { path: '/' });
    return res.json({ ok: true });
  }
}