import { useState } from 'react';

interface FAQ2Props {
  onNavigate?: (page: 'faq1') => void;
}

const FAQ2 = ({ onNavigate }: FAQ2Props) => {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems(prev =>
      prev.includes(index)
        ? prev.filter(item => item !== index)
        : [...prev, index]
    );
  };

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('faq1');
    }
  };

  const faqItems = [
    {
      question: "How do I book an appointment?",
      answer: "You can book an appointment by clicking the 'Set An Appointment' button on our homepage or through your dashboard. Select your preferred date, time, and doctor, then confirm your booking. You'll receive a confirmation email with all the details."
    },
    {
      question: "What is the real-time queue update feature?",
      answer: "Our real-time queue update system keeps you informed about your position in the queue. You'll receive notifications on your dashboard and via email about your current queue position, estimated wait time, and when it's almost your turn."
    },
    {
      question: "Can I reschedule or cancel my appointment?",
      answer: "Yes, you can reschedule or cancel your appointment up to 24 hours before the scheduled time. Simply go to your dashboard, find your appointment, and select the reschedule or cancel option. Please note that cancellations within 24 hours may incur a fee."
    },
    {
      question: "What services do you offer?",
      answer: "We offer comprehensive eye examinations, contact lens fittings, treatment for eye diseases (glaucoma, cataracts, diabetic retinopathy), refractive surgery consultations, pediatric eye care, and emergency eye care services."
    },
    {
      question: "Where is St. Paul Hospital Surigao Eye Center located?",
      answer: "We are located within St. Paul Hospital Surigao, along Borromeo Street, Surigao City. Visit our eye center for expert consultations and patient-focused care."
    },
    {
      question: "Do you provide emergency eye care?",
      answer: "Yes, we provide emergency eye care services for urgent issues such as eye injuries, sudden vision loss, severe eye pain, or foreign objects in the eye. Contact us immediately or visit our clinic during business hours. For after-hours emergencies, call our emergency hotline."
    },
    {
      question: "How can I contact the Eye Center for urgent concerns?",
      answer: "You may reach us through the TimeFly contact form or directly at the St. Paul Hospital Surigao Eye Center front desk. Our staff will be glad to assist you during operating hours. For after-hours emergencies, call us at 0909 400 6245."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-8 transition duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to FAQ
        </button>

        {/* Main Content - Image on left, FAQ on right */}
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Left Side - Larger Image without box */}
          <div className="flex-1">
            <img 
              src="/faq2.png" 
              alt="FAQ Illustration" 
              className="w-full h-auto max-w-md lg:max-w-lg mx-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Right Side - FAQ Items */}
          <div className="flex-1">
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <button
                    onClick={() => toggleItem(index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors group"
                  >
                    <span className="font-medium text-gray-900 text-lg pr-4">
                      {item.question}
                    </span>
                    {/* Simple Down Arrow */}
                    <div className="flex-shrink-0">
                      <svg
                        className={`w-6 h-6 text-gray-400 transition-transform duration-200 ${
                          openItems.includes(index) ? 'transform rotate-180' : ''
                        } group-hover:text-gray-600`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {openItems.includes(index) && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <p className="text-gray-700 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ2;