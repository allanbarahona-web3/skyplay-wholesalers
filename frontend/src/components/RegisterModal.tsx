"use client";

import React, { useState, useRef } from "react";
import { X } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { registerLead } from "@/lib/api";
import SuccessRegistrationModal from "@/components/SuccessRegistrationModal";

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  context?: "catalog" | "login"; // Para analytics/tracking
}

export default function RegisterModal({
  isOpen,
  onClose,
  onSuccess,
  context = "catalog",
}: RegisterModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // Honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successEmail, setSuccessEmail] = useState("");
  const [successData, setSuccessData] = useState<any>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Verificar honeypot (si está lleno, es un bot)
    if (website) {
      console.warn("🚫 Honeypot detectado - potencial bot");
      // Simular éxito para no revelar que es honeypot
      setSuccessEmail(email || "tu@email.com");
      setShowSuccessModal(true);
      return;
    }

    // Validaciones
    if (!email || !name || !phone) {
      setError("Email, nombre y teléfono son requeridos");
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Email inválido");
      return;
    }

    setLoading(true);

    try {
      // Obtener token de reCAPTCHA
      const recaptchaToken = await recaptchaRef.current?.executeAsync();
      
      if (!recaptchaToken) {
        throw new Error("Error al obtener reCAPTCHA token");
      }

      // Llamar al endpoint de registro del BE
      const response = await registerLead({
        email,
        fullname: name,
        telephone: phone,
        message: message || undefined,
        recaptchaToken,
      });

      if (!response.ok) {
        throw new Error(response.error || "Error al enviar solicitud");
      }

      console.log("✅ Lead registrado:", response.data);

      // Guardar email Y datos ANTES de limpiar el formulario
      const registeredEmail = email;
      const registeredData = response.data;

      // Limpiar formulario
      setEmail("");
      setName("");
      setPhone("");
      setMessage("");
      setWebsite("");

      // Cerrar modal de registro primero
      onClose();
      
      // Mostrar modal de éxito CON DELAY para asegurar que se vea
      setTimeout(() => {
        setSuccessEmail(registeredEmail);
        setSuccessData(registeredData);
        setShowSuccessModal(true);
        console.log("🎉 Modal de éxito mostrado para:", registeredEmail);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("❌ Error en registro:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal de Registro */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Solicitud de Mayorista</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tu@email.com"
                disabled={loading}
              />
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tu nombre"
                disabled={loading}
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+506 8765-4321"
                disabled={loading}
              />
            </div>

            {/* Mensaje (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje (opcional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cuéntanos sobre tu negocio..."
                rows={3}
                disabled={loading}
              />
            </div>

            {/* Honeypot - Campo oculto para bots */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ display: "none" }}
              tabIndex={-1}
              autoComplete="off"
            />

            {/* reCAPTCHA */}
            <ReCAPTCHA
              ref={recaptchaRef}
              size="invisible"
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
            />

            {/* Beneficios */}
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
              <p className="font-medium mb-2">✨ Con tu cuenta obtendrás:</p>
              <ul className="space-y-1">
                <li>✓ Descuentos especiales (10-25%)</li>
                <li>✓ Acceso a CRM</li>
                <li>✓ Historial de compras</li>
                <li>✓ Soporte prioritario</li>
              </ul>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition"
            >
              {loading ? "Enviando solicitud..." : "Enviar Solicitud"}
            </button>

            {/* Footer */}
            <p className="text-xs text-gray-600 text-center">
              Nos pondremos en contacto en las próximas 24 horas
            </p>
          </form>
        </div>
      </div>

      {/* Modal de Éxito */}
      <SuccessRegistrationModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        email={successEmail}
        onNavigate={() => {
          // Ejecutar callback cuando el usuario presione "Ir al Catálogo"
          onSuccess(successData);
        }}
      />
    </>
  );
}
