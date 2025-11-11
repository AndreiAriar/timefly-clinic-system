import { useState } from 'react';
import { X } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/config';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ForgotPasswordModal = ({ isOpen, onClose }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
      setLoading(false);
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      // Handle specific Firebase auth errors
      switch (error.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address format');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later');
          break;
        default:
          setError('Failed to send reset email. Please try again');
      }
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    setLoading(false);
    onClose();
  };

  const handleResendEmail = () => {
    setSuccess(false);
    setEmail('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
      <div className="flex items-center justify-center min-h-screen px-4 text-center sm:block sm:p-0">
        {/* Backdrop - Transparent with blur */}
        <div 
          className="fixed inset-0 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        ></div>

        {/* Modal positioning spacer - crucial for vertical centering */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal - Centered */}
        <div className="inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full relative z-[1001]">
          <div className="bg-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 id="forgot-password-title" className="text-xl font-bold text-white">
                Reset Your Password
              </h3>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition"
                aria-label="Close modal"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-6 py-6">
            {success ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Check Your Email</h4>
                <p className="text-gray-600 mb-4">
                  We've sent a password reset link to:
                </p>
                <p className="text-indigo-600 font-semibold mb-4 break-all">{email}</p>
                <p className="text-sm text-gray-500 mb-6">
                  Click the link in the email to reset your password. The link will expire after a short time.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleClose}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleResendEmail}
                    className="w-full border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-3 rounded-lg transition"
                  >
                    Send to another email
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <p className="text-gray-600 mb-4">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="your.email@example.com"
                    disabled={loading}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;