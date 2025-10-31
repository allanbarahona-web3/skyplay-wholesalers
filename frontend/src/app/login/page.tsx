"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetTotp, setResetTotp] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");
  const [resetConfirmPass, setResetConfirmPass] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastOk, setToastOk] = useState(false);

  // Utilidad para mostrar toast
  const toast = (msg: string, ok = false) => {
    setToastMsg(msg);
    setToastOk(ok);
    setTimeout(() => setToastMsg(""), 2600);
  };

  // OTP handlers
  const handleOtpChange = (idx: number, val: string) => {
    if (/\D/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val.slice(0, 1);
    setOtp(newOtp);
    // Focus siguiente input
    if (val && idx < 5) {
      const next = document.getElementById(`otp-${idx + 1}`);
      next && (next as HTMLInputElement).focus();
    }
  };

  // Login handler
  const handleLogin = async () => {
    if (!user) return toast("Ingresa tu correo/usuario");
    if (!pass) return toast("Ingresa tu contraseña");
    if (otp.join("").length < 6) return toast("OTP requerido (6 dígitos)");
    // Aquí iría la llamada real al backend
    // Simulación:
    if (user === "demo" && pass === "demo" && otp.join("") === "123456") {
      router.push("/panel");
    } else {
      toast("Credenciales inválidas");
    }
  };

  // Reset password handler
  const handleReset = async () => {
    if (!resetEmail) return toast("Ingresa tu email");
    if (resetTotp.length !== 6) return toast("Código TOTP debe ser de 6 dígitos");
    if (resetNewPass.length < 8) return toast("La contraseña debe tener al menos 8 caracteres");
    if (resetNewPass !== resetConfirmPass) return toast("Las contraseñas no coinciden");
    // Simulación:
    toast("Contraseña actualizada correctamente", true);
    setResetOpen(false);
    setResetEmail(""); setResetTotp(""); setResetNewPass(""); setResetConfirmPass("");
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/OriginalTransparent.png" alt="Skyplay" className="login-logo" />
          <h1 className="login-title">Acceso para Mayoristas</h1>
          <p className="login-subtitle">Inicia sesión con tus credenciales seguras</p>
        </div>
        <div className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="user">Usuario o correo</label>
            <input 
              id="user" 
              className="login-input" 
              placeholder="correo@empresa.com" 
              autoComplete="username" 
              value={user} 
              onChange={e => setUser(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pass">Contraseña</label>
            <div className="password-wrapper">
              <input 
                id="pass" 
                className="login-input" 
                type={showPass ? "text" : "password"} 
                placeholder="••••••••" 
                autoComplete="current-password" 
                value={pass} 
                onChange={e => setPass(e.target.value)} 
              />
              <button 
                type="button" 
                className="password-toggle" 
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? "👁️" : "👁️"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <div className="otp-header">
              <label className="form-label">Código de Google Authenticator</label>
              <button className="link-button" onClick={() => toast("Función de TOTP simulada")}>
                🔐 Configurar
              </button>
            </div>
            <div className="otp-grid">
              {otp.map((v, i) => (
                <input 
                  key={i} 
                  id={`otp-${i}`} 
                  className="otp-input" 
                  maxLength={1} 
                  inputMode="numeric" 
                  value={v} 
                  onChange={e => handleOtpChange(i, e.target.value)} 
                />
              ))}
            </div>
            <p className="form-hint">6 dígitos, cambia cada 30 segundos</p>
          </div>

          <button className="btn-login-primary" type="button" onClick={handleLogin}>
            Ingresar
          </button>

          <button className="btn-login-secondary" type="button" onClick={() => setResetOpen(true)}>
            Recuperar contraseña
          </button>

          <div className="login-footer">
            ¿Aún no eres mayorista? <a className="login-link" href="#" onClick={e => {e.preventDefault(); router.push("/panel")}}>Solicitar acceso</a>
          </div>
        </div>
      </div>
      {/* Modal de Recuperación */}
      {resetOpen && (
        <div className="modal-overlay" onClick={() => setResetOpen(false)}>
          <div className="login-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-login">
              <h3 className="modal-title-login">Recuperar Contraseña</h3>
              <button className="modal-close-btn" onClick={() => setResetOpen(false)}>✕</button>
            </div>
            <p className="modal-desc">Usa tu email y código de Google Authenticator para restablecer tu contraseña.</p>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="login-input" type="email" placeholder="correo@empresa.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Código de Google Authenticator</label>
                <input className="login-input" type="text" maxLength={6} placeholder="123456" inputMode="numeric" value={resetTotp} onChange={e => setResetTotp(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva Contraseña</label>
                <input className="login-input" type="password" placeholder="Mínimo 8 caracteres" value={resetNewPass} onChange={e => setResetNewPass(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar Contraseña</label>
                <input className="login-input" type="password" placeholder="Repite la contraseña" value={resetConfirmPass} onChange={e => setResetConfirmPass(e.target.value)} />
              </div>
              <button className="btn-login-primary" onClick={handleReset}>Cambiar Contraseña</button>
            </div>
          </div>
        </div>
      )}
      {/* Toast */}
      {toastMsg && (
        <div className={`toast${toastOk ? " ok" : " err"}`}>{toastMsg}</div>
      )}
    </div>
  );
}
