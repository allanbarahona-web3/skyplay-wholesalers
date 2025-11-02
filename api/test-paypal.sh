#!/bin/bash
# Script de prueba para PayPal checkout
# Asegúrate de tener una sesión activa y reemplaza el JWT token

echo "🧪 Testing PayPal Integration"
echo "================================"

# 1. Obtener catálogo
echo -e "\n📦 1. Obteniendo catálogo de productos..."
PRODUCTS=$(curl -s http://localhost:3000/api/services/catalog)
FIRST_PRODUCT=$(echo $PRODUCTS | jq -r '.[3] | {code, name, price}')
PRODUCT_CODE=$(echo $PRODUCTS | jq -r '.[3].code')
echo "Producto seleccionado:"
echo $FIRST_PRODUCT

# 2. Login (necesitas email/password/otp válidos)
echo -e "\n🔐 2. Para probar necesitas hacer login en el navegador"
echo "Abre: http://localhost:3001/login"
echo ""
echo "Una vez logueado, abre DevTools (F12) y ejecuta:"
echo "  document.cookie"
echo ""
echo "Copia el valor de 'sky_sid' y ejecuta:"
echo "  export JWT_TOKEN='tu_valor_aqui'"
echo ""

# Si ya tienes el token
if [ -z "$JWT_TOKEN" ]; then
    echo "⚠️  JWT_TOKEN no está definido. Exporta tu token primero."
    exit 1
fi

# 3. Crear checkout PayPal
echo -e "\n💳 3. Creando checkout de PayPal..."
CHECKOUT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/services/checkout/paypal \
  -H "Content-Type: application/json" \
  -H "Cookie: sky_sid=$JWT_TOKEN" \
  -d "{
    \"product_code\": \"$PRODUCT_CODE\",
    \"quantity\": 1
  }")

echo "Respuesta:"
echo $CHECKOUT_RESPONSE | jq '.'

# Extraer URL de aprobación
APPROVAL_URL=$(echo $CHECKOUT_RESPONSE | jq -r '.approval_url')
PAYPAL_ORDER_ID=$(echo $CHECKOUT_RESPONSE | jq -r '.paypal_order_id')

if [ "$APPROVAL_URL" != "null" ]; then
    echo -e "\n✅ Orden PayPal creada exitosamente!"
    echo "PayPal Order ID: $PAYPAL_ORDER_ID"
    echo ""
    echo "🌐 Abre esta URL en tu navegador para completar el pago:"
    echo "$APPROVAL_URL"
    echo ""
    echo "Usa estas credenciales de Sandbox:"
    echo "  Email: tu_sandbox_buyer@example.com"
    echo "  Password: tu_password"
else
    echo -e "\n❌ Error al crear la orden PayPal"
    echo "Revisa los logs del servidor"
fi
