import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Star, Search, Filter, Calendar, Mail } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface Feedback {
  id: string;
  name: string;
  email: string;
  message: string;
  rating: number;
  photoUrl?: string;
  status: 'new' | 'reviewed' | 'addressed';
  createdAt: Timestamp; // ✅ Fixed: Line 14 - No more 'any'
}

const DisplayFeedback = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<Feedback[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');

  useEffect(() => {
    const feedbacksRef = collection(db, 'feedback');
    const q = query(feedbacksRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedbacksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Feedback[];
      
      setFeedbacks(feedbacksData);
      setFilteredFeedbacks(feedbacksData);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = [...feedbacks];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(fb => 
        fb.name.toLowerCase().includes(query) ||
        fb.email.toLowerCase().includes(query) ||
        fb.message.toLowerCase().includes(query)
      );
    }

    // Rating filter
    if (ratingFilter !== 'all') {
      filtered = filtered.filter(fb => fb.rating === parseInt(ratingFilter));
    }

    setFilteredFeedbacks(filtered);
  }, [feedbacks, searchQuery, ratingFilter]);

  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const StarDisplay = ({ rating }: { rating: number }) => (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? 'text-yellow-400 fill-current'
              : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600';
    if (rating >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Feedback</h1>
          <p className="text-gray-600">Manage and review patient feedback submissions</p>
        </div>

        {/* Summary Stats - MOVED TO TOP */}
        {filteredFeedbacks.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feedback Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{filteredFeedbacks.length}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {filteredFeedbacks.filter(fb => fb.status === 'new').length}
                </p>
                <p className="text-sm text-gray-600">New</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {(filteredFeedbacks.reduce((acc, fb) => acc + fb.rating, 0) / filteredFeedbacks.length).toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Avg Rating</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {filteredFeedbacks.filter(fb => fb.rating >= 4).length}
                </p>
                <p className="text-sm text-gray-600">Positive (4+ stars)</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Feedback
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="search"
                  placeholder="Search by name, email, or feedback..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Rating Filter - REMOVED STATUS FILTER */}
            <div>
              <label htmlFor="ratingFilter" className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Rating
              </label>
              <select
                id="ratingFilter"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || ratingFilter !== 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchQuery && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Search: "{searchQuery}"
                </span>
              )}
              {ratingFilter !== 'all' && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Rating: {ratingFilter} stars
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setRatingFilter('all');
                }}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Feedback List */}
        <div className="space-y-6">
          {filteredFeedbacks.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Feedback Found</h3>
              <p className="text-gray-500">
                {searchQuery || ratingFilter !== 'all'
                  ? 'No feedback matches your current filters.'
                  : 'No patient feedback has been submitted yet.'}
              </p>
            </div>
          ) : (
            filteredFeedbacks.map((feedback) => (
              <div key={feedback.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex flex-col space-y-4">
                    {/* Profile Image, Name, Date, and Rating - STACKED VERTICALLY */}
                    <div className="flex items-start space-x-4">
                      {/* Profile Image - ONLY ROUND PHOTO REMAINS */}
                      <div className="flex-shrink-0">
                        {feedback.photoUrl ? (
                          <img
                            src={feedback.photoUrl}
                            alt={feedback.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-lg border-2 border-blue-600">
                            {getInitials(feedback.name)}
                          </div>
                        )}
                      </div>
                      
                      {/* Name, Date, and Rating stacked vertically */}
                      <div className="flex-1">
                        <div className="flex flex-col space-y-2">
                          {/* Name */}
                          <h3 className="text-lg font-semibold text-gray-900">{feedback.name}</h3>
                          
                          {/* Date */}
                          <div className="flex items-center space-x-1 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{formatDate(feedback.createdAt)}</span>
                          </div>
                          
                          {/* Star Rating */}
                          <div className="flex items-center space-x-2">
                            <StarDisplay rating={feedback.rating} />
                            <span className={`text-sm font-semibold ${getRatingColor(feedback.rating)}`}>
                              {feedback.rating}.0
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Feedback Text */}
                    <div className="mt-2">
                      <p className="text-gray-700 whitespace-pre-wrap">{feedback.message}</p>
                    </div>

                    {/* REMOVED DUPLICATE PHOTO ATTACHMENT SECTION */}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DisplayFeedback;