# 🛡️ Rate Limiting & Protección contra Brute Force

## Implementación

Sistema de protección contra ataques de fuerza bruta y DDoS básico implementado con `express-rate-limit`.

## Niveles de Protección

### 1. **Login Rate Limit** (Protección moderada)
- **Endpoint:** `POST /api/auth/login-otp`
- **Límite:** 5 intentos cada 15 minutos
- **Clave:** IP + Email
- **Mensaje:** "Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo en 15 minutos."

### 2. **Strict Rate Limit** (Protección estricta)
- **Endpoints:**
  - `POST /api/auth/setup-totp`
  - `POST /api/auth/reset-password-totp`
- **Límite:** 3 intentos cada 1 hora
- **Clave:** IP + Email
- **Mensaje:** "Demasiadas solicitudes. Por favor, intenta de nuevo en 1 hora."

### 3. **General Rate Limit** (Protección global)
- **Scope:** Toda la API
- **Límite:** 100 requests por minuto por IP
- **Excepciones:**
  - `/api/health`
  - `/api/services/catalog`
- **Mensaje:** "Demasiadas solicitudes. Por favor, espera un momento."

## Comportamiento

### Respuesta cuando se excede el límite:
```json
{
  "error": "Too many login attempts",
  "message": "Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo en 15 minutos.",
  "retryAfter": 900
}
```

**Status Code:** `429 Too Many Requests`

**Headers:**
```
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 1698876543
```

## Logs de Seguridad

Cuando se excede un límite, se registra:
```
🚨 Rate limit exceeded for IP: 192.168.1.100, Email: attacker@example.com
```

## Configuración

### Variables de entorno (.env):
```bash
# Desactivar rate limiting en desarrollo (OPCIONAL)
NODE_ENV=development
SKIP_RATE_LIMIT=true  # Solo para desarrollo local
```

### Producción:
El rate limiting está **siempre activo** en producción (recomendado).

## Escenarios Protegidos

✅ **Brute Force Attacks** - Limita intentos de adivinación de contraseñas
✅ **Credential Stuffing** - Previene uso masivo de credenciales robadas
✅ **Account Enumeration** - Dificulta descubrir cuentas válidas
✅ **DDoS Básico** - Protege contra sobrecarga de requests
✅ **API Abuse** - Evita uso excesivo de endpoints sensibles

## Mejoras Futuras

🔮 **Posibles implementaciones:**
- Redis store para rate limiting distribuido (múltiples servidores)
- Whitelist de IPs confiables (admin IPs)
- Ban temporal de IPs con comportamiento sospechoso
- CAPTCHA después de X intentos fallidos
- Notificaciones de seguridad por email/WhatsApp

## Testing

### Probar rate limiting:
```bash
# Intentar login 6 veces seguidas con credenciales incorrectas
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login-otp \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong","otp":"000000"}'
  echo "\nIntento $i"
done

# El 6to intento debe devolver 429
```

## Monitoreo

Revisar logs para detectar patrones de ataque:
```bash
# Ver intentos bloqueados
tail -f logs/security.log | grep "Rate limit exceeded"

# Contar ataques por IP
grep "Rate limit" logs/security.log | cut -d' ' -f6 | sort | uniq -c | sort -rn
```

## Referencias

- [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)
- [OWASP Brute Force](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)
