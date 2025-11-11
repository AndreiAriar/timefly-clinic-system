import { useState } from 'react';

const Feedbacks = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Patient",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
      rating: 5,
      text: "The real-time queue system is amazing! I no longer have to wait at the clinic for hours. I can track my position from home and arrive just in time. The doctors are also very professional and caring.",
      date: "October 2024"
    },
    {
      name: "Michael Chen",
      role: "Patient",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
      rating: 5,
      text: "Excellent service! Dr. Santos performed my cataract surgery and the results are incredible. The entire process was smooth, from booking the appointment to post-surgery follow-ups. Highly recommend!",
      date: "September 2024"
    },
    {
      name: "Emily Rodriguez",
      role: "Parent",
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
      rating: 5,
      text: "Dr. Ana Reyes is wonderful with children! My daughter was nervous about her first eye exam, but Dr. Reyes made her feel comfortable. The TimeFly app made scheduling so easy.",
      date: "November 2024"
    },
    {
      name: "Robert Martinez",
      role: "Patient",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
      rating: 5,
      text: "As someone with glaucoma, regular checkups are crucial. TimeFly makes it easy to schedule and track appointments. Dr. Garcia is knowledgeable and always takes time to explain everything thoroughly.",
      date: "October 2024"
    },
    {
      name: "Lisa Anderson",
      role: "Patient",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
      rating: 5,
      text: "Best eye care experience I've had! The facility is modern and clean, the staff is friendly, and the technology they use is top-notch. The online booking system saved me so much time.",
      date: "September 2024"
    },
    {
      name: "David Kim",
      role: "Patient",
      image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
      rating: 5,
      text: "I had an eye emergency and they accommodated me immediately. The staff was professional and efficient. Dr. Cruz's expertise saved my vision. Forever grateful to this amazing team!",
      date: "November 2024"
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex space-x-1">
        {[...Array(5)].map((_, index) => (
          <svg
            key={index}
            className={`w-5 h-5 ${index < rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Patient Feedbacks</h2>
          <div className="w-24 h-1 bg-indigo-600 mx-auto mb-6"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Hear what our patients have to say about their experience with TimeFly
          </p>
        </div>

        {/* Testimonial Slider */}
        <div className="relative max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="shrink-0">
                <img
                  src={testimonials[currentSlide].image}
                  alt={testimonials[currentSlide].name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-indigo-100"
                />
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="mb-4">
                  {renderStars(testimonials[currentSlide].rating)}
                </div>
                
                <p className="text-gray-700 text-lg leading-relaxed mb-6 italic">
                  "{testimonials[currentSlide].text}"
                </p>
                
                <div>
                  <p className="font-bold text-gray-900 text-lg">
                    {testimonials[currentSlide].name}
                  </p>
                  <p className="text-indigo-600 font-medium">
                    {testimonials[currentSlide].role}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {testimonials[currentSlide].date}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white hover:bg-gray-50 text-gray-800 p-3 rounded-full shadow-lg transition-all duration-200"
            aria-label="Previous testimonial"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white hover:bg-gray-50 text-gray-800 p-3 rounded-full shadow-lg transition-all duration-200"
            aria-label="Next testimonial"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="flex justify-center mt-8 space-x-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentSlide ? 'bg-indigo-600 w-8' : 'bg-gray-300'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mt-20">
          <div className="text-center">
            <p className="text-4xl font-bold text-indigo-600 mb-2">5,000+</p>
            <p className="text-gray-600">Happy Patients</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-indigo-600 mb-2">4.9/5</p>
            <p className="text-gray-600">Average Rating</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-indigo-600 mb-2">98%</p>
            <p className="text-gray-600">Satisfaction Rate</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-indigo-600 mb-2">10+</p>
            <p className="text-gray-600">Years of Service</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 bg-linear-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">Ready to experience quality eye care?</h3>
          <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
            Join thousands of satisfied patients who trust TimeFly for their eye care needs
          </p>
          <button className="bg-white text-indigo-600 hover:bg-gray-100 font-semibold px-8 py-3 rounded-lg transition-colors duration-200">
            Book Your Appointment Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default Feedbacks;