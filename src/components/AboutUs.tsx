const AboutUs = () => {
  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">About Us</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Dedicated to providing exceptional eye care with real-time appointment management
          </p>
        </div>

        {/* Rest of the AboutUs content remains the same */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
           <img
                src="/about-image.png"
                alt="About TimeFly"
                className="rounded-2xl shadow-2xl w-full h-auto"
              />
            <div className="absolute -bottom-6 -right-6 bg-indigo-600 text-white p-6 rounded-lg shadow-xl">
              <p className="text-4xl font-bold">10+</p>
              <p className="text-sm">Years of Service</p>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-3xl font-bold text-gray-900">
              Your Vision, Our Priority
            </h3>
            <p className="text-gray-600 leading-relaxed">
              TimeFly is a revolutionary healthcare platform designed to streamline eye care appointments 
              and provide real-time queue updates. We understand that your time is valuable, which is why 
              we've created a system that keeps you informed every step of the way.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Located at Saint Paul Surigao University Hospital, our team of experienced ophthalmologists 
              and optometrists are committed to providing comprehensive eye care services using the latest 
              technology and treatment methods.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-indigo-600 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-900">Real-Time Updates</h4>
                  <p className="text-gray-600">Get instant notifications about your queue position and appointment status</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-indigo-600 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-900">Expert Care</h4>
                  <p className="text-gray-600">Experienced ophthalmologists with years of specialized training</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-indigo-600 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-900">Modern Technology</h4>
                  <p className="text-gray-600">State-of-the-art equipment for accurate diagnosis and treatment</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-20">
          <div className="bg-linear-to-br from-indigo-50 to-purple-50 p-8 rounded-2xl">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h3>
            <p className="text-gray-600 leading-relaxed">
              To provide accessible, high-quality eye care services while revolutionizing the patient 
              experience through innovative technology and compassionate care.
            </p>
          </div>

          <div className="bg-linear-to-br from-purple-50 to-pink-50 p-8 rounded-2xl">
          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Vision</h3>
            <p className="text-gray-600 leading-relaxed">
              To be the leading eye care provider in the region, known for excellence in patient care, 
              innovative solutions, and commitment to preserving and enhancing vision for all.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
          