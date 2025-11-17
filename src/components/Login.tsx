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

    // User is now logged in and Firebase Auth context will handle the rest
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
      <div 
        className="min-h-screen flex items-center justify-center px-4 py-12 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: 'url(/bgauth.jpg)' }}
      >
         <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full space-y-8 p-8 border border-white/40">
          {/* Logo */}
          <div className="text-center">
            <img 
              src="/timefly_logo.png" 
              alt="TimeFly Logo" 
              className="h-16 w-auto mx-auto mb-4 drop-shadow-lg"
            />
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">Welcome Back</h2>
            <p className="mt-2 text-white/90 drop-shadow-md">Sign in to your account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/50 text-white px-4 py-3 rounded-lg text-sm drop-shadow-lg">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white drop-shadow-md mb-1">
                  Email Address
                </label>
              <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition focus:bg-white/10"
                  placeholder="your.email@example.com"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white drop-shadow-md mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition pr-10 focus:bg-white/10"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/70 hover:text-white"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-white focus:ring-white/50 border-white/40 rounded bg-white/10"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-white drop-shadow-md">
                  Remember me
                </label>
              </div>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-white hover:text-white/80 drop-shadow-md"
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white/10 backdrop-blur-sm hover:bg-white/10 text-white font-semibold py-3 rounded-lg transition duration-200 border border-white/40 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

       {/* Divider */}
        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-white/40"></div>
          <span className="flex-shrink mx-4 text-sm text-white/80 drop-shadow-md">Or continue with</span>
          <div className="flex-grow border-t border-white/40"></div>
        </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/40 rounded-lg text-white hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#ffffff"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#ffffff"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#ffffff"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#ffffff"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-white font-medium drop-shadow-md">Sign in with Google</span>
          </button>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-sm text-white/90 drop-shadow-md">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="text-white hover:text-white/70 font-semibold drop-shadow-md"
                disabled={loading}
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </>
  );
};

export default Login;