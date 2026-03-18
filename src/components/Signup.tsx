import { useState } from 'react';
import { registerUser, loginWithGoogle, logoutUser } from '../services/authService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SignupProps {
  onSignup: () => void;
  onSwitchToLogin: () => void;
  onSignupStart: () => void;
}

const Signup = ({ onSignup, onSwitchToLogin, onSignupStart }: SignupProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sentCode, setSentCode] = useState('');

  const sendVerificationCode = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setVerificationSent(true);
        setSentCode(data.code);
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) { clearInterval(timer); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(data.error || 'Failed to send verification code');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !confirmPassword) { setError('Please fill in all fields'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Please enter a valid email'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!verificationSent || !verificationCode) { setError('Please verify your email first'); return; }
    setLoading(true);
    onSignupStart();
    try {
      if (verificationCode !== sentCode) { setError('Invalid verification code'); setLoading(false); return; }
      const result = await registerUser(email, password);
      if (result.error) { setError(result.error); setLoading(false); return; }
      if (!result.user) { setError('Failed to create account'); setLoading(false); return; }
      const userDocRef = doc(db, 'users', result.user.uid);
      await setDoc(userDocRef, {
        uid: result.user.uid, email: result.user.email, displayName: name.trim(),
        photoURL: '', role: 'patient', emailVerified: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      await logoutUser();
      setSuccess(true);
      setLoading(false);
      setTimeout(() => { onSignup(); }, 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred during signup');
      setLoading(false);
      try { await logoutUser(); } catch { /* ignore logout error */ }
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    onSignupStart();
    try {
      const result = await loginWithGoogle();
      if (result.error) { setError(result.error); setLoading(false); return; }
      if (!result.user) { setError('Failed to sign in with Google'); setLoading(false); return; }
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: result.user.uid, email: result.user.email,
          displayName: result.user.displayName || '', photoURL: result.user.photoURL || '',
          role: 'patient', emailVerified: true,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
      }
      await logoutUser();
      setSuccess(true);
      setTimeout(() => { setLoading(false); onSignup(); }, 1500);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred during Google signup');
      setLoading(false);
      try { await logoutUser(); } catch { /* ignore logout error */ }
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .signup-root {
          font-family: 'Plus Jakarta Sans', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #2563eb 70%, #1e40af 100%);
          padding: 24px 16px;
        }

        .signup-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 15% 20%, rgba(59, 130, 246, 0.45) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 85% 75%, rgba(29, 78, 216, 0.6) 0%, transparent 60%);
          z-index: 0;
        }

        /* ── Decorative background ── */
        .signup-bg-decor {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          overflow: hidden;
        }

        .su-hourglass { position: absolute; color: #fff; }
        .su-hourglass svg { width: 100%; height: 100%; fill: currentColor; }
        .su-hg-1 { width: 120px; height: 120px; top: 8%;    left: 5%;    transform: rotate(-15deg); opacity: 0.11; }
        .su-hg-2 { width: 80px;  height: 80px;  top: 65%;   left: 3%;    transform: rotate(20deg);  opacity: 0.07; }
        .su-hg-3 { width: 160px; height: 160px; top: 18%;   right: 4%;   transform: rotate(10deg);  opacity: 0.09; }
        .su-hg-4 { width: 90px;  height: 90px;  top: 74%;   right: 7%;   transform: rotate(-25deg); opacity: 0.08; }
        .su-hg-5 { width: 50px;  height: 50px;  top: 44%;   left: 20%;   transform: rotate(5deg);   opacity: 0.06; }
        .su-hg-6 { width: 70px;  height: 70px;  bottom: 9%; right: 22%;  transform: rotate(-10deg); opacity: 0.07; }

        .su-cross { position: absolute; color: #fff; }
        .su-cross svg { width: 100%; height: 100%; fill: currentColor; }
        .su-cr-1 { width: 55px; height: 55px; top: 12%;    left: 28%;  opacity: 0.07; }
        .su-cr-2 { width: 35px; height: 35px; top: 80%;    left: 40%;  opacity: 0.06; }
        .su-cr-3 { width: 70px; height: 70px; top: 34%;    right: 20%; opacity: 0.05; }
        .su-cr-4 { width: 40px; height: 40px; bottom: 17%; left: 15%;  opacity: 0.06; }
        .su-cr-5 { width: 28px; height: 28px; top: 55%;    right: 35%; opacity: 0.05; }
        .su-cr-6 { width: 50px; height: 50px; top: 5%;     right: 30%; opacity: 0.05; }

        /* ── Card ── */
        .signup-card {
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
        .signup-logo {
          text-align: center;
          margin-bottom: 20px;
        }
        .signup-logo img {
          height: 40px;
          width: auto;
          margin: 0 auto 10px;
          display: block;
          filter: brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.2));
        }
        .signup-logo h2 {
          font-size: 1.2rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 3px;
          letter-spacing: -0.01em;
        }
        .signup-logo p {
          font-size: 0.76rem;
          color: rgba(255,255,255,0.6);
          margin: 0;
        }

        /* ── Alert messages ── */
        .su-alert {
          padding: 9px 13px;
          border-radius: 10px;
          font-size: 0.75rem;
          margin-bottom: 14px;
          color: #fff;
        }
        .su-alert-error {
          background: rgba(239, 68, 68, 0.18);
          border: 1px solid rgba(239, 68, 68, 0.4);
        }
        .su-alert-success {
          background: rgba(34, 197, 94, 0.18);
          border: 1px solid rgba(34, 197, 94, 0.4);
        }

        /* ── Fields ── */
        .su-field-group {
          display: flex;
          flex-direction: column;
          gap: 9px;
          margin-bottom: 14px;
        }

        .su-field-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          color: rgba(255,255,255,0.82);
          margin-bottom: 5px;
          letter-spacing: 0.015em;
        }

        .su-field-input {
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
        .su-field-input::placeholder { color: rgba(255,255,255,0.38); }
        .su-field-input:focus {
          border-color: rgba(255,255,255,0.52);
          background: rgba(255,255,255,0.13);
        }
        .su-field-input:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Email row with send code button */
        .su-email-row {
          display: flex;
          gap: 7px;
        }
        .su-email-row .su-field-input {
          flex: 1;
          min-width: 0;
        }
        .su-send-btn {
          flex-shrink: 0;
          padding: 9px 11px;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.26);
          border-radius: 10px;
          color: #fff;
          font-family: inherit;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.2s;
        }
        .su-send-btn:hover:not(:disabled) { background: rgba(255,255,255,0.16); }
        .su-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .su-hint {
          margin-top: 4px;
          font-size: 0.68rem;
          color: rgba(255,255,255,0.5);
        }

        /* Password toggle wrapper */
        .su-pwd-wrap { position: relative; }
        .su-pwd-wrap .su-field-input { padding-right: 38px; }
        .su-pwd-toggle {
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
        .su-pwd-toggle:hover { color: rgba(255,255,255,0.9); }

        /* ── Submit button ── */
        .su-submit-btn {
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
        .su-submit-btn:hover:not(:disabled) {
          background: rgba(10, 25, 90, 0.85);
          transform: translateY(-1px);
        }
        .su-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .su-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Terms ── */
        .su-terms {
          text-align: center;
          margin-top: 12px;
          font-size: 0.68rem;
          color: rgba(255,255,255,0.5);
          line-height: 1.5;
        }
        .su-terms a {
          color: rgba(255,255,255,0.75);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s;
        }
        .su-terms a:hover { color: #fff; }

        /* ── Divider ── */
        .su-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 14px 0;
        }
        .su-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.2);
        }
        .su-divider-text {
          font-size: 0.68rem;
          color: rgba(255,255,255,0.5);
          white-space: nowrap;
        }

        /* ── Google button ── */
        .su-google-btn {
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
        .su-google-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.17);
          transform: translateY(-1px);
        }
        .su-google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .su-google-icon {
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

        /* ── Sign-in link ── */
        .su-signin-link {
          text-align: center;
          margin-top: 14px;
          font-size: 0.74rem;
          color: rgba(255,255,255,0.6);
        }
        .su-signin-link button {
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
        .su-signin-link button:hover { opacity: 0.72; }
      `}</style>

      <div className="signup-root">

        {/* ── Background decorative elements ── */}
        <div className="signup-bg-decor">
          {['su-hg-1','su-hg-2','su-hg-3','su-hg-4','su-hg-5','su-hg-6'].map(cls => (
            <span key={cls} className={`su-hourglass ${cls}`}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2h12v2c0 3.31-2.69 6-6 6S6 7.31 6 4V2zM6 22v-2c0-3.31 2.69-6 6-6s6 2.69 6 6v2H6zM8 4c0 2.21 1.79 4 4 4s4-1.79 4-4H8zM8 20h8c0-2.21-1.79-4-4-4s-4 1.79-4 4z"/>
              </svg>
            </span>
          ))}
          {['su-cr-1','su-cr-2','su-cr-3','su-cr-4','su-cr-5','su-cr-6'].map(cls => (
            <span key={cls} className={`su-cross ${cls}`}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
              </svg>
            </span>
          ))}
        </div>

        {/* ── Signup card ── */}
        <div className="signup-card">

          {/* Logo */}
          <div className="signup-logo">
            <img src="/cliniqueue.jpg" alt="CliniQueue Logo" />
            <h2>Create Account</h2>
            <p>Join us today</p>
          </div>

          {/* Alerts */}
          {success && (
            <div className="su-alert su-alert-success">
              Account created! Redirecting to login…
            </div>
          )}
          {error && (
            <div className="su-alert su-alert-error">{error}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="su-field-group">

              {/* Full Name */}
              <div>
                <label htmlFor="name" className="su-field-label">Full Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="su-field-input"
                  placeholder="Tyler Durden"
                  disabled={success || loading}
                  style={{ WebkitBoxShadow: '0 0 0 1000px rgba(255,255,255,0.07) inset', WebkitTextFillColor: 'white' }}
                />
              </div>

              {/* Email + Send Code */}
              <div>
                <label htmlFor="email" className="su-field-label">Email</label>
                <div className="su-email-row">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="su-field-input"
                    placeholder="username@gmail.com"
                    disabled={success || loading || verificationSent}
                    style={{ WebkitBoxShadow: '0 0 0 1000px rgba(255,255,255,0.07) inset', WebkitTextFillColor: 'white' }}
                  />
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={success || loading || verificationSent || countdown > 0}
                    className="su-send-btn"
                  >
                    {countdown > 0 ? `${countdown}s` : 'Send Code'}
                  </button>
                </div>
                <p className="su-hint">
                  {verificationSent ? 'Verification code sent to your email' : 'We\'ll send a verification code to your email'}
                </p>
              </div>

              {/* Verification Code */}
              {verificationSent && (
                <div>
                  <label htmlFor="verificationCode" className="su-field-label">Verification Code</label>
                  <input
                    id="verificationCode"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="su-field-input"
                    placeholder="Enter 6-digit code"
                    disabled={success || loading}
                    maxLength={6}
                    style={{ WebkitBoxShadow: '0 0 0 1000px rgba(255,255,255,0.07) inset', WebkitTextFillColor: 'white' }}
                  />
                </div>
              )}

              {/* Password */}
              <div>
                <label htmlFor="password" className="su-field-label">Password</label>
                <div className="su-pwd-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="su-field-input"
                    placeholder="Min. 6 characters"
                    disabled={success || loading}
                    style={{ WebkitBoxShadow: '0 0 0 1000px rgba(255,255,255,0.07) inset', WebkitTextFillColor: 'white' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="su-pwd-toggle" disabled={success || loading}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="su-field-label">Confirm Password</label>
                <div className="su-pwd-wrap">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="su-field-input"
                    placeholder="Repeat password"
                    disabled={success || loading}
                    style={{ WebkitBoxShadow: '0 0 0 1000px rgba(255,255,255,0.07) inset', WebkitTextFillColor: 'white' }}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="su-pwd-toggle" disabled={success || loading}>
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="su-submit-btn"
              disabled={success || loading || !verificationSent}
            >
              {success ? 'Account Created!' : loading ? 'Creating Account…' : 'Create Account'}
            </button>
          </form>

          {/* Terms */}
          <p className="su-terms">
            By signing up, you agree to our{' '}
            <Link to="/terms-of-use">Terms of Use</Link> and{' '}
            <Link to="/privacy-policy">Privacy Policy</Link>.
          </p>

          {/* Divider */}
          <div className="su-divider">
            <div className="su-divider-line" />
            <span className="su-divider-text">or continue with</span>
            <div className="su-divider-line" />
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogleSignup}
            disabled={success || loading}
            className="su-google-btn"
            aria-label="Sign up with Google"
          >
            <div className="su-google-icon">
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
          </button>

          {/* Sign in link */}
          <div className="su-signin-link">
            Already have an account?{' '}
            <button onClick={onSwitchToLogin} disabled={success || loading}>
              Sign in
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;