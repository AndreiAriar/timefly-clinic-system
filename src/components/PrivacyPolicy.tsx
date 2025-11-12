const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <li>Your insurance details</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">How We Protect Your Information</h2>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
              <li>We use secure computer systems</li>
              <li>Only doctors and nurses can see your information</li>
              <li>We regularly check our security</li>
              <li>Our staff are trained to protect your privacy</li>
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