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
    <div className="wrap">
      <section className="card">
        <div className="brand">
          <div className="logo" style={{ background: 'transparent', border: '2px solid rgba(59,130,246,0.3)', padding: '1px' }}>
            <img src="/White on Transparent.png" alt="Skyplay" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <h1>Acceso para Mayoristas</h1>
            <p className="lead">Inicia sesión con Usuario/Correo + Contraseña + OTP</p>
          </div>
        </div>
        <div className="form">
          <div>
            <label htmlFor="user">Usuario o correo</label>
            <input id="user" className="input" placeholder="correo@empresa.com" autoComplete="username" value={user} onChange={e => setUser(e.target.value)} />
            <button className="btn secondary" type="button" style={{ marginTop: '8px' }} onClick={() => toast("Función de TOTP simulada")}>🔐 Configurar Google Authenticator</button>
          </div>
          <div>
            <label htmlFor="pass">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input id="pass" className="input" type={showPass ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" style={{ paddingRight: '40px' }} value={pass} onChange={e => setPass(e.target.value)} />
              <button type="button" id="togglePass" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }} onClick={() => setShowPass(!showPass)}>👁️</button>
            </div>
            <div className="hint">Pon tu contraseña.</div>
          </div>
          <div>
            <div className="meta">
              <label>Código de Google Authenticator</label>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>(6 dígitos, cambia cada 30 seg)</span>
            </div>
            <div className="otpGrid">
              {otp.map((v, i) => (
                <input key={i} id={`otp-${i}`} className="otpInput" maxLength={1} inputMode="numeric" value={v} onChange={e => handleOtpChange(i, e.target.value)} />
              ))}
            </div>
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={handleLogin}>Ingresar</button>
            <button className="btn secondary" type="button" onClick={() => setResetOpen(true)}>Recuperar contraseña</button>
          </div>
          <div className="footnote">
            ¿Aún no eres mayorista? <a className="link" href="#" onClick={e => {e.preventDefault(); router.push("/panel")}}>Solicitar acceso</a>
          </div>
        </div>
      </section>
      <section className="hero">
        <h2>Catálogo mayorista</h2>
        <p>Tras validar tu OTP podrás ver el catálogo y comprar en condiciones preferenciales.</p>
        <p className="footnote">PWA listo: puedes instalar este acceso en tu celular y entrar más rápido.</p>
      </section>
      {/* Modal de Recuperación */}
      {resetOpen && (
        <div className="modal open">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-head">
              <h3 style={{ margin: '0', color: '#e5e7eb' }}>Recuperar Contraseña</h3>
              <button className="btn" onClick={() => setResetOpen(false)}>✕</button>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '12px 0' }}>Usa tu email y código de Google Authenticator para restablecer tu contraseña.</p>
            <div style={{ display: 'grid', gap: '14px', marginTop: '16px' }}>
              <div>
                <label style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Email</label>
                <input className="input" type="email" placeholder="correo@empresa.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Código de Google Authenticator</label>
                <input className="input" type="text" maxLength={6} placeholder="123456" inputMode="numeric" value={resetTotp} onChange={e => setResetTotp(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Nueva Contraseña</label>
                <input className="input" type="password" placeholder="Mínimo 8 caracteres" value={resetNewPass} onChange={e => setResetNewPass(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Confirmar Contraseña</label>
                <input className="input" type="password" placeholder="Repite la contraseña" value={resetConfirmPass} onChange={e => setResetConfirmPass(e.target.value)} />
              </div>
              <button className="btn primary" style={{ marginTop: '8px' }} onClick={handleReset}>Cambiar Contraseña</button>
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
