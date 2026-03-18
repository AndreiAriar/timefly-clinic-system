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

interface PatientFeedbackProps {
  currentUserName?: string;
  currentUserPhoto?: string;
  currentUserEmail?: string;
}

const PatientFeedback = ({ currentUserName, currentUserPhoto, currentUserEmail }: PatientFeedbackProps) => {
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
            name: data.userName || data.name || '',
            email: data.userEmail || data.email || '',
            message: data.message || '',
            rating: data.rating || 0,
            createdAt: data.createdAt
          };
        });

        const total = querySnapshot.size;
        const averageRating = feedbacksData.length > 0 
          ? feedbacksData.reduce((acc, fb) => acc + fb.rating, 0) / feedbacksData.length
          : 0;

        // Stats data is fetched but not used - keeping for potential future use
        console.log('Feedback stats loaded:', {
          total,
          averageRating,
          recentFeedbacks: feedbacksData
        });
      } catch (error) {
        console.error('Error fetching feedback stats:', error);
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
    return (
      <FeedbackForm 
        onBack={handleBackToFeedback}
        currentUserName={currentUserName}
        currentUserPhoto={currentUserPhoto}
        currentUserEmail={currentUserEmail}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content - No Box */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          {/* Left Side - Text Content */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">We Value Your Feedback</h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Your experience helps us improve our healthcare services. Please take a moment to share your thoughts and help us make CliniQueue even better for everyone.
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
      </div>
    </div>
  );
};

export default PatientFeedback;