-- Agregar columna paid_price a la tabla services
ALTER TABLE services ADD COLUMN IF NOT EXISTS paid_price NUMERIC(10,2);

-- Actualizar servicios existentes con el precio del catálogo como fallback
UPDATE services s
SET paid_price = p.price
FROM products p
WHERE s.product_code = p.code
  AND s.paid_price IS NULL;

COMMENT ON COLUMN services.paid_price IS 'Precio efectivamente pagado por el servicio (puede incluir descuentos)';
