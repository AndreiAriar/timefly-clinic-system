import { useNavigate } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <footer className="bg-blue-600 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center items-center mb-4">
            <button
              onClick={handleLogoClick}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <img 
                src="/cliniqueue.jpg" 
                alt="CliniQueue" 
                className="h-8 w-auto filter brightness-0 invert"
              />
              <span className="text-lg font-bold text-white">CliniQueue</span>
            </button>
          </div>
          
          {/* Copyright Text - Reverted to original boldness */}
          <p className="text-white/90 text-sm">
            CliniQueue - Clinic Scheduling and Queue Management<br />
            © 2025 CliniQueue. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;