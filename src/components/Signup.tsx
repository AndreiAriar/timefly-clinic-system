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

// Send verification code
const sendVerificationCode = async () => {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    setError('Please enter a valid email address');
    return;
  }

  setLoading(true);
  setError('');

  try {
    const response = await fetch('http://localhost:3001/send-verification-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      setVerificationSent(true);
      setCountdown(60); // 60 seconds countdown
      
      // Start countdown
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
      // Verify the code first
     const verifyResponse = await fetch('http://localhost:3001/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(verifyData.error || 'Invalid verification code');
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

      // Step 4: Show success and redirect
      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        onSignup();
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

      // Step 5: Show success and redirect
      setSuccess(true);

      setTimeout(() => {
        setLoading(false);
        onSignup();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
        {/* Logo */}
        <div className="text-center">
          <img 
            src="/timefly_logo.png" 
            alt="TimeFly Logo" 
            className="h-16 w-auto mx-auto mb-4"
          />
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mt-2 text-gray-600">Join TimeFly today</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            Account created successfully! Redirecting to login...
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Signup Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="Tyler Durden"
                disabled={success || loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="flex space-x-2">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="your.email@example.com"
                  disabled={success || loading || verificationSent}
                />
                <button
                  type="button"
                  onClick={sendVerificationCode}
                  disabled={success || loading || verificationSent || countdown > 0}
                  className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition whitespace-nowrap text-sm"
                >
                  {countdown > 0 ? `${countdown}s` : 'Send Code'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {verificationSent 
                  ? 'Verification code sent to your email' 
                  : 'We\'ll send a verification code to your email'}
              </p>
            </div>

            {verificationSent && (
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Code
                </label>
                <input
                  id="verificationCode"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="Enter 6-digit code"
                  disabled={success || loading}
                  maxLength={6}
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition pr-10"
                  placeholder="••••••••"
                  disabled={success || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  disabled={success || loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition pr-10"
                  placeholder="••••••••"
                  disabled={success || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
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
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {success ? 'Account Created!' : loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        {/* Google Sign Up */}
        <button
          onClick={handleGoogleSignup}
          disabled={success || loading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-gray-700 font-medium">Sign up with Google</span>
        </button>

        {/* Sign In Link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-indigo-600 hover:text-indigo-500 font-semibold"
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