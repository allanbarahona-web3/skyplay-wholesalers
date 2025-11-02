/**
 * Script para generar credenciales de prueba de Ethereal Email
 * Ejecutar: node scripts/setup-test-email.js
 */

const nodemailer = require('nodemailer');

async function createTestAccount() {
  try {
    console.log('🔄 Generando cuenta de prueba con Ethereal Email...\n');
    
    // Crear cuenta de prueba
    const testAccount = await nodemailer.createTestAccount();
    
    console.log('✅ Cuenta creada exitosamente!\n');
    console.log('📧 Credenciales SMTP para testing:\n');
    console.log('SMTP_HOST=smtp.ethereal.email');
    console.log('SMTP_PORT=587');
    console.log('SMTP_SECURE=false');
    console.log(`SMTP_USER=${testAccount.user}`);
    console.log(`SMTP_PASS=${testAccount.pass}`);
    console.log('\n📌 Copia estas líneas a tu archivo api/.env\n');
    console.log('🌐 Para ver los emails enviados, ve a:');
    console.log(`   https://ethereal.email/messages\n`);
    console.log('   Usuario:', testAccount.user);
    console.log('   Contraseña:', testAccount.pass);
    console.log('\n💡 Tip: Los emails se capturan pero NO se envían realmente.');
    console.log('    Perfecto para desarrollo y testing!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestAccount();
