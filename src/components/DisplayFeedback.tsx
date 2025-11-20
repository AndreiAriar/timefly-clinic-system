import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Star, Search, Filter, Calendar, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface Feedback {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  rating: number;
  userPhoto: string;
  category?: string;
  status: 'new' | 'reviewed' | 'addressed';
  createdAt: Timestamp;
}

const DisplayFeedback = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<Feedback[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const feedbacksRef = collection(db, 'feedback');
    const q = query(feedbacksRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedbacksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Feedback[];
      
      console.log('Fetched feedbacks:', feedbacksData); // Debug log
      setFeedbacks(feedbacksData);
      setFilteredFeedbacks(feedbacksData);
    }, (error) => {
      console.error("Error fetching feedback:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = [...feedbacks];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(fb => {
        const name = fb.userName || '';
        const email = fb.userEmail || '';
        const message = fb.message || '';
        const category = fb.category || '';
        
        return name.toLowerCase().includes(query) ||
               email.toLowerCase().includes(query) ||
               message.toLowerCase().includes(query) ||
               category.toLowerCase().includes(query);
      });
    }

    if (ratingFilter !== 'all') {
      filtered = filtered.filter(fb => fb.rating === parseInt(ratingFilter));
    }

    setFilteredFeedbacks(filtered);
    setCurrentIndex(0);
  }, [feedbacks, searchQuery, ratingFilter]);

  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const StarDisplay = ({ rating }: { rating: number }) => (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 sm:w-6 sm:h-6 ${
            star <= rating
              ? 'text-yellow-400 fill-yellow-400'
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

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredFeedbacks.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < filteredFeedbacks.length - 1 ? prev + 1 : 0));
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  const currentFeedback = filteredFeedbacks[currentIndex];
  const displayName = currentFeedback?.userName || 'Patient';
  const displayPhoto = currentFeedback?.userPhoto || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-6 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Elegant Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-block p-2 sm:p-3 bg-blue-100 rounded-2xl mb-3 sm:mb-4">
            <MessageSquare className="w-8 h-8 sm:w-12 sm:h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">Patient Feedback</h1>
          <p className="text-base sm:text-lg text-gray-600 px-4">Hear what our patients have to say about their TimeFly experience</p>
        </div>

        {/* Modern Summary Stats */}
        {filteredFeedbacks.length > 0 && (
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-8 mb-6 sm:mb-8 border border-blue-100">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">Feedback Overview</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl sm:rounded-2xl">
                <p className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">{filteredFeedbacks.length}</p>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Reviews</p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl sm:rounded-2xl">
                <p className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">
                  {filteredFeedbacks.filter(fb => fb.status === 'new').length}
                </p>
                <p className="text-xs sm:text-sm font-medium text-gray-600">New Feedback</p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl sm:rounded-2xl">
                <p className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">
                  {(filteredFeedbacks.reduce((acc, fb) => acc + fb.rating, 0) / filteredFeedbacks.length).toFixed(1)}
                </p>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Average Rating</p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl sm:rounded-2xl">
                <p className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">
                  {filteredFeedbacks.filter(fb => fb.rating >= 4).length}
                </p>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Positive (4+★)</p>
              </div>
            </div>
          </div>
        )}

        {/* Premium Filters */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                Search Feedback
              </label>
              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                <input
                  type="text"
                  id="search"
                  placeholder="Search by name, email, or feedback..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-blue-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ratingFilter" className="block text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                <Filter className="inline w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Filter by Rating
              </label>
              <select
                id="ratingFilter"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-blue-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              >
                <option value="all">All Ratings</option>
                <option value="5">★★★★★ (5 Stars)</option>
                <option value="4">★★★★ (4 Stars)</option>
                <option value="3">★★★ (3 Stars)</option>
                <option value="2">★★ (2 Stars)</option>
                <option value="1">★ (1 Star)</option>
              </select>
            </div>
          </div>

          {(searchQuery || ratingFilter !== 'all') && (
            <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3 items-center">
              <span className="text-xs sm:text-sm font-semibold text-gray-600">Active filters:</span>
              {searchQuery && (
                <span className="px-3 sm:px-4 py-1 sm:py-2 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-medium">
                  Search: "{searchQuery}"
                </span>
              )}
              {ratingFilter !== 'all' && (
                <span className="px-3 sm:px-4 py-1 sm:py-2 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-medium">
                  Rating: {ratingFilter} stars
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setRatingFilter('all');
                }}
                className="px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-all"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Feedback Display */}
        {filteredFeedbacks.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-8 sm:p-16 text-center border border-blue-100">
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <MessageSquare className="w-8 h-8 sm:w-12 sm:h-12 text-blue-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-700 mb-2 sm:mb-3">No Feedback Found</h3>
            <p className="text-gray-500 text-sm sm:text-lg px-4">
              {searchQuery || ratingFilter !== 'all'
                ? 'No feedback matches your current filters. Try adjusting your search.'
                : 'No patient feedback has been submitted yet. Be the first to share your experience!'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-blue-100">
            <div className="p-4 sm:p-6 md:p-10">
              {currentFeedback && (
                <div className="space-y-6 sm:space-y-8">
                  {/* Premium User Profile Section */}
                  <div className="flex flex-col items-center text-center space-y-4 sm:space-y-6">
                    <div className="relative">
                      {displayPhoto ? (
                        <img
                          key={displayPhoto}
                          src={displayPhoto}
                          alt={displayName}
                          className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-blue-200 shadow-xl"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white shadow-xl"
                        style={{ display: displayPhoto ? 'none' : 'flex' }}
                      >
                        <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                      <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 bg-white rounded-full p-1.5 sm:p-2 shadow-lg border-2 border-blue-200">
                        <Star className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400 fill-yellow-400" />
                      </div>
                    </div>
                    
                    <div className="space-y-3 sm:space-y-4">
                      <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        {displayName}
                      </h3>
                      
                      {currentFeedback.category && (
                        <span className="inline-flex items-center px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md">
                          {currentFeedback.category}
                        </span>
                      )}
                      
                      <div className="flex items-center justify-center space-x-2 text-gray-600">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                        <span className="text-xs sm:text-sm font-medium">{formatDate(currentFeedback.createdAt)}</span>
                      </div>
                      
                      <div className="flex flex-col items-center space-y-2">
                        <StarDisplay rating={currentFeedback.rating || 0} />
                        <span className={`text-xl sm:text-2xl font-bold ${getRatingColor(currentFeedback.rating || 0)}`}>
                          {currentFeedback.rating || 0}.0 / 5.0
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Premium Feedback Message Box - Smaller and More Responsive */}
                  <div className="relative mt-6 sm:mt-8">
                    <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold shadow-lg whitespace-nowrap">
                      Patient Feedback
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-blue-200 shadow-inner mx-auto max-w-xs sm:max-w-md lg:max-w-lg w-full">
                      <p className="text-gray-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-center font-medium break-words">
                        "{currentFeedback.message || 'No message provided'}"
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Elegant Navigation Controls */}
              <div className="mt-8 sm:mt-12 flex flex-col items-center space-y-4 sm:space-y-6">
                <div className="flex items-center justify-center space-x-3 sm:space-x-4">
                  <button
                    onClick={handlePrevious}
                    className="p-2 sm:p-3 rounded-full bg-white hover:bg-blue-50 border-2 border-blue-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    disabled={filteredFeedbacks.length <= 1}
                    aria-label="Previous feedback"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </button>

                  <div className="flex items-center space-x-1.5 sm:space-x-2 px-4 sm:px-6 py-1.5 sm:py-2 bg-blue-50 rounded-full">
                    {filteredFeedbacks.slice(0, 10).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => handleDotClick(index)}
                        className={`transition-all ${
                          index === currentIndex
                            ? 'w-3 h-3 sm:w-4 sm:h-4 bg-blue-600 rounded-full shadow-md'
                            : 'w-2 h-2 sm:w-3 sm:h-3 bg-blue-300 rounded-full hover:bg-blue-400'
                        }`}
                        aria-label={`Go to feedback ${index + 1}`}
                      />
                    ))}
                    {filteredFeedbacks.length > 10 && (
                      <span className="text-blue-600 font-semibold text-xs sm:text-sm ml-1">+{filteredFeedbacks.length - 10}</span>
                    )}
                  </div>

                  <button
                    onClick={handleNext}
                    className="p-2 sm:p-3 rounded-full bg-white hover:bg-blue-50 border-2 border-blue-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    disabled={filteredFeedbacks.length <= 1}
                    aria-label="Next feedback"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </button>
                </div>

                <div className="flex items-center space-x-3 text-xs sm:text-sm">
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-100 text-blue-700 rounded-full font-semibold">
                    Viewing {currentIndex + 1} of {filteredFeedbacks.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DisplayFeedback;