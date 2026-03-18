import { useState } from 'react';
import { loginUser, loginWithGoogle } from '../services/authService';
import { Eye, EyeOff } from 'lucide-react';
import ForgotPasswordModal from './ForgotPasswordModal';

interface LoginProps {
  onSwitchToSignup: () => void;
}

const Login = ({ onSwitchToSignup }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await loginUser(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    const result = await loginWithGoogle();

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  const handleForgotPassword = () => {
    setShowForgotPasswordModal(true);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .login-root {
          font-family: 'Plus Jakarta Sans', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #2563eb 70%, #1e40af 100%);
        }

        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 15% 20%, rgba(59, 130, 246, 0.45) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 85% 75%, rgba(29, 78, 216, 0.6) 0%, transparent 60%);
          z-index: 0;
        }

        /* ── Decorative background ── */
        .bg-decor {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          overflow: hidden;
        }

        .hourglass {
          position: absolute;
          color: #fff;
        }
        .hourglass svg { width: 100%; height: 100%; fill: currentColor; }

        .hg-1 { width: 120px; height: 120px; top: 8%;    left: 5%;    transform: rotate(-15deg); opacity: 0.11; }
        .hg-2 { width: 80px;  height: 80px;  top: 65%;   left: 3%;    transform: rotate(20deg);  opacity: 0.07; }
        .hg-3 { width: 160px; height: 160px; top: 18%;   right: 4%;   transform: rotate(10deg);  opacity: 0.09; }
        .hg-4 { width: 90px;  height: 90px;  top: 74%;   right: 7%;   transform: rotate(-25deg); opacity: 0.08; }
        .hg-5 { width: 50px;  height: 50px;  top: 44%;   left: 20%;   transform: rotate(5deg);   opacity: 0.06; }
        .hg-6 { width: 70px;  height: 70px;  bottom: 9%; right: 22%;  transform: rotate(-10deg); opacity: 0.07; }

        .cross {
          position: absolute;
          color: #fff;
        }
        .cross svg { width: 100%; height: 100%; fill: currentColor; }

        .cr-1 { width: 55px; height: 55px; top: 12%;    left: 28%;  opacity: 0.07; }
        .cr-2 { width: 35px; height: 35px; top: 80%;    left: 40%;  opacity: 0.06; }
        .cr-3 { width: 70px; height: 70px; top: 34%;    right: 20%; opacity: 0.05; }
        .cr-4 { width: 40px; height: 40px; bottom: 17%; left: 15%;  opacity: 0.06; }
        .cr-5 { width: 28px; height: 28px; top: 55%;    right: 35%; opacity: 0.05; }
        .cr-6 { width: 50px; height: 50px; top: 5%;     right: 30%; opacity: 0.05; }

        /* ── Card ── */
        .login-card {
          position: relative;
          z-index: 10;
          background: rgba(255, 255, 255, 0.10);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 20px;
          padding: 32px 28px 28px;
          width: 100%;
          max-width: 330px;
          box-shadow:
            0 8px 40px rgba(15, 40, 120, 0.4),
            0 1px 0 rgba(255,255,255,0.15) inset;
        }

        /* ── Logo ── */
        .login-logo {
          text-align: center;
          margin-bottom: 20px;
        }
        .login-logo img {
          height: 40px;
          width: auto;
          margin: 0 auto 10px;
          display: block;
          filter: brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.2));
        }
        .login-logo h2 {
          font-size: 1.2rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 3px;
          letter-spacing: -0.01em;
        }
        .login-logo p {
          font-size: 0.76rem;
          color: rgba(255,255,255,0.6);
          margin: 0;
        }

        /* ── Error ── */
        .login-error {
          background: rgba(239, 68, 68, 0.18);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fff;
          padding: 9px 13px;
          border-radius: 10px;
          font-size: 0.75rem;
          margin-bottom: 14px;
        }

        /* ── Fields ── */
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 9px;
          margin-bottom: 8px;
        }

        .field-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          color: rgba(255,255,255,0.82);
          margin-bottom: 5px;
          letter-spacing: 0.015em;
        }

        .field-input {
          width: 100%;
          padding: 9px 12px;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.26);
          border-radius: 10px;
          color: #fff;
          font-family: inherit;
          font-size: 0.82rem;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
          -webkit-box-shadow: 0 0 0 1000px rgba(255,255,255,0.07) inset;
          -webkit-text-fill-color: white;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.38); }
        .field-input:focus {
          border-color: rgba(255,255,255,0.52);
          background: rgba(255,255,255,0.13);
        }

        .password-wrap { position: relative; }
        .password-wrap .field-input { padding-right: 38px; }

        .pwd-toggle {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.5);
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .pwd-toggle:hover { color: rgba(255,255,255,0.9); }

        /* ── Forgot row (left-aligned, no Remember Me) ── */
        .login-meta {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          margin: 8px 0 14px;
        }
        .forgot-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.68);
          padding: 0;
          font-family: inherit;
          transition: color 0.15s;
        }
        .forgot-btn:hover { color: #fff; }

        /* ── Sign in button ── */
        .signin-btn {
          width: 100%;
          padding: 10px;
          background: rgba(10, 25, 90, 0.65);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          color: #fff;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: background 0.2s, transform 0.1s;
          box-shadow: 0 2px 14px rgba(0,0,0,0.28);
        }
        .signin-btn:hover:not(:disabled) {
          background: rgba(10, 25, 90, 0.85);
          transform: translateY(-1px);
        }
        .signin-btn:active:not(:disabled) { transform: translateY(0); }
        .signin-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Divider ── */
        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 14px 0;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.2);
        }
        .divider-text {
          font-size: 0.68rem;
          color: rgba(255,255,255,0.5);
          white-space: nowrap;
        }

        /* ── Google button (icon only) ── */
        .google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 9px;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          font-family: inherit;
        }
        .google-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.17);
          transform: translateY(-1px);
        }
        .google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .google-icon-wrap {
          width: 26px;
          height: 26px;
          background: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        }

        /* ── Sign-up link ── */
        .signup-link {
          text-align: center;
          margin-top: 14px;
          font-size: 0.74rem;
          color: rgba(255,255,255,0.6);
        }
        .signup-link button {
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-size: inherit;
          font-weight: 700;
          color: #fff;
          padding: 0;
          transition: opacity 0.15s;
        }
        .signup-link button:hover { opacity: 0.72; }
      `}</style>

      <div className="login-root">

        {/* ── Background decorative elements ── */}
        <div className="bg-decor">
          {['hg-1','hg-2','hg-3','hg-4','hg-5','hg-6'].map(cls => (
            <span key={cls} className={`hourglass ${cls}`}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2h12v2c0 3.31-2.69 6-6 6S6 7.31 6 4V2zM6 22v-2c0-3.31 2.69-6 6-6s6 2.69 6 6v2H6zM8 4c0 2.21 1.79 4 4 4s4-1.79 4-4H8zM8 20h8c0-2.21-1.79-4-4-4s-4 1.79-4 4z"/>
              </svg>
            </span>
          ))}

          {['cr-1','cr-2','cr-3','cr-4','cr-5','cr-6'].map(cls => (
            <span key={cls} className={`cross ${cls}`}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
              </svg>
            </span>
          ))}
        </div>

        {/* ── Login card ── */}
        <div className="login-card">

          {/* Logo */}
          <div className="login-logo">
            <img src="/cliniqueue.jpg" alt="CliniQueue Logo" />
            <h2>Welcome Back</h2>
            <p>Sign in to your account</p>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">{error}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <div>
                <label htmlFor="email" className="field-label">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  placeholder="username@gmail.com"
                  disabled={loading}
                  style={{
                    WebkitBoxShadow: '0 0 0 1000px rgba(255,255,255,0.07) inset',
                    WebkitTextFillColor: 'white',
                  }}
                />
              </div>

              <div>
                <label htmlFor="password" className="field-label">Password</label>
                <div className="password-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field-input"
                    placeholder="Password"
                    disabled={loading}
                    style={{
                      WebkitBoxShadow: '0 0 0 1000px rgba(255,255,255,0.07) inset',
                      WebkitTextFillColor: 'white',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="pwd-toggle"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Forgot Password — left-aligned, no Remember Me */}
            <div className="login-meta">
              <button
                type="button"
                className="forgot-btn"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              className="signin-btn"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="divider">
            <div className="divider-line" />
            <span className="divider-text">or continue with</span>
            <div className="divider-line" />
          </div>

          {/* Google icon-only button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="google-btn"
            aria-label="Sign in with Google"
          >
            <div className="google-icon-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
          </button>

          {/* Sign up */}
          <div className="signup-link">
            Don't have an account?{' '}
            <button onClick={onSwitchToSignup} disabled={loading}>
              Signup
            </button>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </>
  );
};

export default Login;