import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Back Button and Logo */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleBack}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10 19l-7-7m0 0l7-7m-7 7h18" 
              />
            </svg>
            Back
          </button>
          
          <div className="flex items-center justify-center flex-1">
            <div className="flex items-center space-x-3">
              <img 
                src="/timefly_logo.png" 
                alt="TimeFly Logo" 
                className="h-10 w-10"
              />
              <h1 className="text-3xl font-bold text-blue-600">TimeFly</h1>
            </div>
          </div>
          
          {/* Spacer to balance the header */}
          <div className="w-20"></div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6 text-center">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              At TimeFly, we take your privacy seriously. We want you to feel safe and confident when sharing your personal health information with us.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Your Privacy Matters</h2>
            <p className="text-gray-700 mb-4">
              We follow the <strong>Data Privacy Act of 2012</strong> to protect your personal information. This means:
            </p>
            
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
              <li>Your medical records and health information are kept safe and private</li>
              <li>We only collect information needed for your healthcare</li>
              <li>Your data is used only for your medical care</li>
              <li>We follow strict rules to protect your privacy</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">What Information We Collect</h2>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
              <li>Your name and contact information</li>
              <li>Your medical history and health records</li>
              <li>Your appointment information</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">How We Protect Your Information</h2>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
              <li>We use Firebase’s secure infrastructure and encrypted connections to keep your data safe.</li>
              <li>Your information is stored in Firestore database collections and documents with strict access controls.</li>
              <li>Only authorized clinic staff can view your information when needed for care.</li>
              <li>We regularly review and update our security measures.</li>
              <li>Our team is trained to handle your data responsibly and maintain your privacy.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Your Rights</h2>
            <p className="text-gray-700 mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
              <li>Know how we use your information</li>
              <li>See your medical records</li>
              <li>Fix any wrong information</li>
              <li>Get a copy of your health information</li>
              <li>Ask questions about your privacy</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;