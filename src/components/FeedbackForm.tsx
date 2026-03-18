import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase/config';
import { Star, ArrowLeft, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface FeedbackFormProps {
  onBack: () => void;
  currentUserName?: string;
  currentUserPhoto?: string;
  currentUserEmail?: string;
}

interface UserData {
  name: string;
  email: string;
  photoURL: string;
}

const FeedbackForm = ({ onBack, currentUserName, currentUserPhoto, currentUserEmail }: FeedbackFormProps) => {
  const [formData, setFormData] = useState({
    message: '',
    rating: 0,
    category: ''
  });
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const categories = [
    'Easy to use',
    'Smooth booking experience',
    'Queue time was acceptable',
    'Staff were friendly',
    'Doctor was helpful',
    'Updates were clear',
    'Overall good experience',
  ];

  // Toast notification function
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Load user data from Firebase and use current profile data
  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Priority: Use props > Firebase Auth > Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userDataFromFirestore = userDoc.data();
          
          setUserData({
            name: currentUserName || user.displayName || userDataFromFirestore?.name || 'User',
            email: currentUserEmail || user.email || '',
            photoURL: currentUserPhoto || user.photoURL || userDataFromFirestore?.photoURL || ''
          });
        } catch (error) {
          console.error('Error loading user data:', error);
          // Fallback to props and auth data
          setUserData({
            name: currentUserName || user.displayName || 'User',
            email: currentUserEmail || user.email || '',
            photoURL: currentUserPhoto || user.photoURL || ''
          });
        }
      } else {
        setUserData(null);
      }
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, [currentUserName, currentUserPhoto, currentUserEmail]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRatingClick = (rating: number) => {
    setFormData(prev => ({ ...prev, rating }));
  };

  const handleCategorySelect = (category: string) => {
    setFormData(prev => ({ ...prev, category }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.message || formData.rating === 0 || !formData.category) {
      showToast('Please provide a rating, select a category, and write your feedback.', 'warning');
      return;
    }

    if (!userData) {
      showToast('Please sign in to submit feedback.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'feedback'), {
        userId: getAuth().currentUser?.uid,
        userName: userData.name,
        userEmail: userData.email,
        userPhoto: userData.photoURL,
        message: formData.message,
        rating: formData.rating,
        category: formData.category,
        status: 'new',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      showToast('Thank you for your feedback! We appreciate you helping us improve TimeFly Clinic.', 'success');
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showToast('Sorry, there was an error submitting your feedback. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarRating = () => (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => handleRatingClick(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          className="focus:outline-none"
        >
          <Star
            className={`w-8 h-8 ${
              star <= (hoverRating || formData.rating)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Top-Centered Toast Notification */}
      {toast && toast.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[200] w-full max-w-md px-4">
          <div className={`
            flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg mx-auto
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-orange-500 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
            animate-slide-down
          `}>
            {toast.type === 'success' && <CheckCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'warning' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-6 h-6 flex-shrink-0" />}
            <p className="font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-80 transition flex-shrink-0"
              aria-label="Close notification"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button - Outside Modal */}
        <div className="mb-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={isSubmitting}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header with TimeFly Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/cliniqueue.jpg" 
                alt="CliniQueue" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Share Your Feedback</h1>
            <p className="text-gray-600">Help us improve CliniQueue clinic services</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Star Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Overall Rating <span className="text-red-500">*</span>
              </label>
              <div className="flex justify-center">
                <StarRating />
              </div>
              <p className="text-sm text-gray-500 mt-2 text-center">
                {formData.rating === 0 ? 'Select your rating' : `You rated: ${formData.rating} star${formData.rating > 1 ? 's' : ''}`}
              </p>
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tell us about your experience <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategorySelect(category)}
                    className={`flex items-center justify-center p-4 rounded-full border-2 transition-all ${
                      formData.category === category
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <span className="text-sm font-medium text-center">{category}</span>
                  </button>
                ))}
              </div>
              {formData.category && (
                <p className="text-sm text-gray-500 mt-2">
                  Selected: {formData.category}
                </p>
              )}
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Your Suggestions <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                required
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-vertical"
                placeholder="Please share your suggestions, experience, or any concerns..."
              />
            </div>

            {/* Submit Button Only */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Add slide-down animation */}
      <style>
        {`
          @keyframes slide-down {
            from {
              transform: translateY(-100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
          .animate-slide-down {
            animation: slide-down 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default FeedbackForm;