import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiter para endpoints de autenticación
 * Protege contra ataques de fuerza bruta
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos por ventana
  message: {
    error: 'Too many login attempts',
    message: 'Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo en 15 minutos.',
    retryAfter: 15 * 60, // segundos
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Usar IP + email como clave para rate limiting (con soporte IPv6)
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const normalizedIp = ipKeyGenerator(ip as string);
    return `${normalizedIp}:${email}`;
  },

  // Skip rate limiting en desarrollo si es necesario
  skip: (req) => {
    return process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true';
  },

  // Handler personalizado cuando se excede el límite
  handler: (req, res) => {
    console.warn(`🚨 Rate limit exceeded for IP: ${req.ip}, Email: ${req.body?.email || 'N/A'}`);
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo en 15 minutos.',
      retryAfter: 15 * 60,
    });
  },
});

/**
 * Rate limiter más estricto para endpoints sensibles (reset password, setup TOTP)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo 3 intentos por hora
  message: {
    error: 'Too many requests',
    message: 'Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const normalizedIp = ipKeyGenerator(ip as string);
    return `strict:${normalizedIp}:${email}`;
  },

  handler: (req, res) => {
    console.warn(`🚨 Strict rate limit exceeded for IP: ${req.ip}, Email: ${req.body?.email || 'N/A'}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Demasiadas solicitudes. Por favor, intenta de nuevo en 1 hora.',
      retryAfter: 60 * 60,
    });
  },
});

/**
 * Rate limiter general para API (protección contra DDoS básico)
 */
export const generalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // Máximo 100 requests por minuto por IP
  message: {
    error: 'Too many requests',
    message: 'Demasiadas solicitudes. Por favor, espera un momento.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  skip: (req) => {
    // Skip para health checks y endpoints públicos
    const publicPaths = ['/api/health', '/api/services/catalog'];
    return publicPaths.some(path => req.path.startsWith(path));
  },
});
