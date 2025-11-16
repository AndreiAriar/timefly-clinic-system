const Footer = () => {
  return (
    <footer className="bg-[#22395d] border-t border-blue-700 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center items-center mb-4">
            <img 
              src="/timefly_logo.png" 
              alt="TimeFly" 
              className="h-8 w-auto"
            />
            <span className="ml-2 text-lg font-bold text-white">TimeFly</span>
          </div>
          
          {/* Copyright Text */}
          <p className="text-white/90 text-sm">
            TimeFly - Clinic Scheduling and Queue Management<br />
            © 2025 TimeFly. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;