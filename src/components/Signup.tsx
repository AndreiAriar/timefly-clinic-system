import { useState } from 'react';
import { registerUser, loginWithGoogle, logoutUser } from '../services/authService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Eye, EyeOff } from 'lucide-react';

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

  // Send verification code
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      setVerificationSent(true);
      setSentCode(data.code); // Store the code from API response
      setCountdown(60);
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
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

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!verificationSent || !verificationCode) {
      setError('Please verify your email first');
      return;
    }

    setLoading(true);
    onSignupStart();

    try {
   
      // Verify the code locally
        if (verificationCode !== sentCode) {
          setError('Invalid verification code');
          setLoading(false);
          return;
        }

      // Step 1: Create the user account
      const result = await registerUser(email, password);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (!result.user) {
        setError('Failed to create account');
        setLoading(false);
        return;
      }

      // Step 2: Create Firestore document
      const userDocRef = doc(db, 'users', result.user.uid);
      await setDoc(userDocRef, {
        uid: result.user.uid,
        email: result.user.email,
        displayName: name.trim(),
        photoURL: '',
        role: 'patient',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log('✅ User document created successfully with ID:', result.user.uid);

      // Step 3: Logout the user
      await logoutUser();
      console.log('✅ User logged out after signup');

      // Step 4: Show success and redirect to login
      setSuccess(true);
      setLoading(false);

      // Redirect to login after showing success message
      setTimeout(() => {
        onSignup(); // This should now switch to login view
      }, 2000);

    } catch (error) {
      console.error('❌ Signup error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during signup');
      setLoading(false);
      
      // Try to logout anyway
      try {
        await logoutUser();
      } catch (logoutError) {
        console.error('Logout error:', logoutError);
      }
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    onSignupStart();

    try {
      // Step 1: Sign in with Google
      const result = await loginWithGoogle();

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (!result.user) {
        setError('Failed to sign in with Google');
        setLoading(false);
        return;
      }

      // Step 2: Check if user document exists
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Step 3: Create user document if it doesn't exist
        await setDoc(userDocRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName || '',
          photoURL: result.user.photoURL || '',
          role: 'patient',
          emailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log('✅ User document created successfully with ID:', result.user.uid);
      } else {
        console.log('ℹ️ User document already exists');
      }

      // Step 4: Logout the user
      await logoutUser();
      console.log('✅ User logged out after Google signup');

      // Step 5: Show success and redirect to login
      setSuccess(true);

      setTimeout(() => {
        setLoading(false);
        onSignup(); // This should now switch to login view
      }, 1500);

    } catch (error) {
      console.error('❌ Google signup error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during Google signup');
      setLoading(false);
      
      // Try to logout anyway
      try {
        await logoutUser();
      } catch (logoutError) {
        console.error('Logout error:', logoutError);
      }
    }
  };

  return (
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
          <h2 className="text-3xl font-bold text-white drop-shadow-lg">Create Account</h2>
          <p className="mt-2 text-white/90 drop-shadow-md">Join TimeFly today</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-500/20 backdrop-blur-sm border border-green-400/50 text-white px-4 py-3 rounded-lg text-sm drop-shadow-lg">
            Account created successfully! Redirecting to login...
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/50 text-white px-4 py-3 rounded-lg text-sm drop-shadow-lg">
            {error}
          </div>
        )}

        {/* Signup Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white drop-shadow-md mb-1">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition"
                placeholder="Tyler Durden"
                disabled={success || loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white drop-shadow-md mb-1">
                Email Address
              </label>
              <div className="flex space-x-2">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition"
                  placeholder="your.email@example.com"
                  disabled={success || loading || verificationSent}
                />
                <button
                  type="button"
                  onClick={sendVerificationCode}
                  disabled={success || loading || verificationSent || countdown > 0}
                  className="px-4 py-3 bg-white/10 backdrop-blur-sm hover:bg-white/10 text-white rounded-lg border border-white/40 disabled:opacity-50 transition whitespace-nowrap text-sm"
                >
                  {countdown > 0 ? `${countdown}s` : 'Send Code'}
                </button>
              </div>
              <p className="mt-1 text-xs text-white/70 drop-shadow-sm">
                {verificationSent 
                  ? 'Verification code sent to your email' 
                  : 'We\'ll send a verification code to your email'}
              </p>
            </div>

            {verificationSent && (
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-white drop-shadow-md mb-1">
                  Verification Code
                </label>
                <input
                  id="verificationCode"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition"
                  placeholder="Enter 6-digit code"
                  disabled={success || loading}
                  maxLength={6}
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white drop-shadow-md mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition pr-10"
                  placeholder="••••••••"
                  disabled={success || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/70 hover:text-white"
                  disabled={success || loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-white/70 drop-shadow-sm">Must be at least 6 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white drop-shadow-md mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none transition pr-10"
                  placeholder="••••••••"
                  disabled={success || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/70 hover:text-white"
                  disabled={success || loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={success || loading || !verificationSent}
            className="w-full bg-white/20 backdrop-blur-sm hover:bg-white/20 text-white font-semibold py-3 rounded-lg transition duration-200 border border-white/40 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {success ? 'Account Created!' : loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-white/40"></div>
          <span className="flex-shrink mx-4 text-sm text-white/80 drop-shadow-md">Or continue with</span>
          <div className="flex-grow border-t border-white/40"></div>
        </div>

        {/* Google Sign Up */}
        <button
          onClick={handleGoogleSignup}
          disabled={success || loading}
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
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#ffffff"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-white font-medium drop-shadow-md">Sign up with Google</span>
        </button>

        {/* Sign In Link */}
        <div className="text-center">
          <p className="text-sm text-white/90 drop-shadow-md">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-white hover:text-white/80 font-semibold drop-shadow-md"
              disabled={success || loading}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;