import { useState } from 'react';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
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
      question: "What should I bring to my first appointment?",
      answer: "Please bring a valid ID, your insurance card (if applicable), any previous eye prescriptions or medical records, a list of current medications, and arrive 15 minutes early to complete any necessary paperwork."
    },
    {
      question: "Do you accept insurance?",
      answer: "Yes, we accept most major insurance providers including PhilHealth, HMOs, and private insurance plans. Please contact our office or check your insurance provider's website to verify coverage. You can also add your insurance information to your profile."
    },
    {
      question: "How long does a typical eye examination take?",
      answer: "A comprehensive eye examination typically takes 45-60 minutes. This includes vision testing, eye health evaluation, and discussion of results. If additional tests are needed, the appointment may take longer. We'll inform you of the estimated time when you book."
    },
    {
      question: "What services do you offer?",
      answer: "We offer comprehensive eye examinations, contact lens fittings, treatment for eye diseases (glaucoma, cataracts, diabetic retinopathy), refractive surgery consultations, pediatric eye care, and emergency eye care services."
    },
    {
      question: "How often should I have my eyes checked?",
      answer: "Adults should have a comprehensive eye exam every 1-2 years, or annually if you wear contacts or have existing eye conditions. Children should have their first exam at 6 months, then at age 3, and before starting school. Seniors over 60 should have annual exams."
    },
    {
      question: "What are your clinic hours?",
      answer: "We're open Monday to Friday from 8:00 AM to 6:00 PM, and Saturdays from 9:00 AM to 3:00 PM. We're closed on Sundays and public holidays. For emergencies outside business hours, please contact our 24/7 emergency hotline."
    },
    {
      question: "Do you provide emergency eye care?",
      answer: "Yes, we provide emergency eye care services for urgent issues such as eye injuries, sudden vision loss, severe eye pain, or foreign objects in the eye. Contact us immediately or visit our clinic during business hours. For after-hours emergencies, call our emergency hotline."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <div className="w-24 h-1 bg-indigo-600 mx-auto mb-6"></div>
          <p className="text-xl text-gray-600">
            Find answers to common questions about our services and appointments
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none"
              >
                <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-indigo-600 shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-16 bg-linear-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h3>
          <p className="text-gray-600 mb-6">
            Our team is here to help! Contact us and we'll get back to you as soon as possible.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:timefly.healthcare@gmail.com"
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Email Us</span>
            </a>
            <a
              href="tel:09094006245"
              className="inline-flex items-center space-x-2 bg-white hover:bg-gray-50 text-indigo-600 border-2 border-indigo-600 px-6 py-3 rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>Call Us</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;