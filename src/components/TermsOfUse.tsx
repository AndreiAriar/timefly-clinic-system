import { useNavigate } from 'react-router-dom';

const TermsOfUse = () => {
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
              <h1 className="text-3xl font-bold text-blue-500">TimeFly</h1>
            </div>
          </div>
          
          {/* Spacer to balance the header */}
          <div className="w-20"></div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6 text-center">Terms of Use</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              Welcome to TimeFly. By using our services, you agree to these terms and conditions.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Acceptance of Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing and using TimeFly, you accept and agree to be bound by the terms and provision of this agreement.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Use License</h2>
            <p className="text-gray-700 mb-4">
              Permission is granted to temporarily use TimeFly's services for personal, non-commercial transitory viewing only.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">User Account</h2>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
              <li>You are responsible for maintaining the confidentiality of your account</li>
              <li>Use our services responsibly and according to our guidelines.</li>
              <li>You agree to provide accurate and complete information</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Medical Disclaimer</h2>
            <p className="text-gray-700 mb-4">
            TimeFly provides health information for general wellness purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment from a qualified healthcare provider.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Limitations</h2>
            <p className="text-gray-700 mb-4">
              In no event shall TimeFly or its suppliers be liable for any damages arising out of the use or inability to use our services.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Governing Law</h2>
            <p className="text-gray-700 mb-4">
              These terms shall be governed by and construed in accordance with the laws of the Philippines, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Contact Information</h3>
              <p className="text-blue-800">
                If you have any questions about these Terms of Use, please contact us at timefly.healthcare@gmail.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUse;