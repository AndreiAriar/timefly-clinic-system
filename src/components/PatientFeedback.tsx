import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import FeedbackForm from './FeedbackForm';

interface FeedbackItem {
  id: string;
  name: string;
  email: string;
  message: string;
  rating: number;
  createdAt: Timestamp;
}

interface FeedbackStats {
  total: number;
  averageRating: number;
  recentFeedbacks: FeedbackItem[];
}

const PatientFeedback = () => {
  const [stats, setStats] = useState<FeedbackStats>({
    total: 0,
    averageRating: 0,
    recentFeedbacks: []
  });
  const [loading, setLoading] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  useEffect(() => {
    const fetchFeedbackStats = async () => {
      try {
        const feedbacksRef = collection(db, 'feedback');
        const q = query(feedbacksRef, orderBy('createdAt', 'desc'), limit(5));
        const querySnapshot = await getDocs(q);
        
        const feedbacksData: FeedbackItem[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            email: data.email || '',
            message: data.message || '',
            rating: data.rating || 0,
            createdAt: data.createdAt
          };
        });

        const total = querySnapshot.size;
        const averageRating = feedbacksData.length > 0 
          ? feedbacksData.reduce((acc, fb) => acc + fb.rating, 0) / feedbacksData.length
          : 0;

        setStats({
          total,
          averageRating,
          recentFeedbacks: feedbacksData
        });
      } catch (error) {
        console.error('Error fetching feedback stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedbackStats();
  }, []);

  const handleShareFeedback = () => {
    setShowFeedbackForm(true);
  };

  const handleBackToFeedback = () => {
    setShowFeedbackForm(false);
  };

  if (showFeedbackForm) {
    return <FeedbackForm onBack={handleBackToFeedback} />;
  }

  const StarDisplay = ({ rating }: { rating: number }) => (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? 'text-yellow-400 fill-current'
              : 'text-gray-300'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content - No Box */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          {/* Left Side - Text Content */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">We Value Your Feedback</h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Your experience helps us improve our healthcare services. Please take a moment to share your thoughts and help us make TimeFly even better for everyone.
            </p>
      <button
        onClick={handleShareFeedback}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg transition duration-200 transform hover:scale-105 shadow-lg text-lg w-80"
      >
        Share Your Feedback
      </button>
          </div>
          
          {/* Right Side - Image */}
          <div className="flex-1 flex justify-center">
            <div className="text-center">
              <img 
                src="/feedback.png"
                alt="Feedback" 
                className="w-96 h-96 mx-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>

        {/* Recent Feedbacks Preview */}
        {!loading && stats.recentFeedbacks.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Recent Patient Feedback</h2>
            <div className="grid gap-4">
              {stats.recentFeedbacks.slice(0, 3).map((feedback) => (
                <div key={feedback.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{feedback.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{feedback.email}</p>
                    </div>
                    <div className="text-right">
                      <StarDisplay rating={feedback.rating} />
                      <span className="text-sm text-gray-600 mt-1 block">
                        {feedback.rating}.0 stars
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm">{feedback.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientFeedback;