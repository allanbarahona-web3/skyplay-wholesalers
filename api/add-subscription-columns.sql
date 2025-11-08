-- Agregar columnas para manejar pausas y cancelaciones programadas
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS remaining_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP DEFAULT NULL;

-- Comentarios para documentar
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'Si true, la suscripción se cancelará al final del período actual';
COMMENT ON COLUMN subscriptions.remaining_days IS 'Días restantes cuando se pausa la suscripción (para reactivar después)';
COMMENT ON COLUMN subscriptions.paused_at IS 'Fecha cuando se pausó la suscripción';
