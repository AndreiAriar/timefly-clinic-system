interface FAQ1Props {
  onNavigate?: (page: 'faq2') => void;
}

const FAQ1 = ({ onNavigate }: FAQ1Props) => {
  const handleLearnMore = () => {
    if (onNavigate) {
      onNavigate('faq2');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Main Content - Centered vertically and horizontally */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
          {/* Left Side - Text Content - Always centered */}
          <div className="flex-1 text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Get answers to your questions
            </p>
            <button
              onClick={handleLearnMore}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg transition duration-200 transform hover:scale-105 shadow-lg text-lg mx-auto"
            >
              Learn More
            </button>
          </div>
          
          {/* Right Side - Image - Always centered */}
          <div className="flex-1 flex justify-center">
            <div className="text-center">
              <img 
                src="/faq1.png"
                alt="FAQ Illustration" 
                className="w-full max-w-lg h-auto mx-auto"
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

export default FAQ1;