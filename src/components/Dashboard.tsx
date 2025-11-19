import { useState, useRef, useEffect } from 'react';
import Home from './Home';
import AboutUs from './AboutUs';
import OurDoctors from './OurDoctors';
import FAQ1 from './FAQ1';  
import FAQ2 from './FAQ2';  
import PatientFeedback from './PatientFeedback';
import Appointments from './Appointments';
import Queue from './Queue';
import ContactUs from './ContactUs';


interface DashboardProps {
  userEmail: string;
  userName?: string;
  userPhoto?: string;
  onLogout: () => void;
}

type PageType = 'home' | 'appointments' | 'queue' | 'about' | 'doctors' | 'faq' | 'faq2' | 'feedback' | 'contact';



const Dashboard = ({ userEmail, userName, userPhoto, onLogout }: DashboardProps) => {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string>(userPhoto || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userPhoto) {
      setProfilePhoto(userPhoto);
    }
  }, [userPhoto]);

const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    // ✅ REMOVED FILE SIZE LIMIT - Only validate file type
    const validTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif', 
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/svg+xml'
    ];
    
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, WebP, BMP, TIFF, or SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePhoto(reader.result as string);
    };
    reader.onerror = () => {
      alert('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
  }
};

  const handleChangePhotoClick = () => {
    fileInputRef.current?.click();
    setIsDesktopDropdownOpen(false);
    setIsMobileDropdownOpen(false);
  };

  const getInitials = (email: string, name?: string) => {
    if (name) {
      const names = name.split(' ');
      if (names.length >= 2) {
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
      }
      return name.charAt(0).toUpperCase();
    }
    return email.charAt(0).toUpperCase();
  };

  const displayName = userName || 'User';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (desktopDropdownRef.current && !desktopDropdownRef.current.contains(target)) {
        setIsDesktopDropdownOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(target)) {
        setIsMobileDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        // Check if the click is on the hamburger button itself
        if (hamburgerButtonRef.current && !hamburgerButtonRef.current.contains(target)) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    if (isDesktopDropdownOpen || isMobileDropdownOpen || isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDesktopDropdownOpen, isMobileDropdownOpen, isMobileMenuOpen]);
  
  const handleNavClick = (page: PageType) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    setIsDesktopDropdownOpen(false);
    setIsMobileDropdownOpen(false);
    onLogout();
  };
  
const renderPage = () => {
  switch (currentPage) {
    case 'home':
      return <Home />;
    case 'appointments':
      return <Appointments />;
    case 'queue':
      return <Queue />;
    case 'about':
      return <AboutUs />;
    case 'doctors':
      return <OurDoctors />;
    case 'faq':
      return <FAQ1 onNavigate={() => handleNavClick('faq2')} />;
    case 'faq2':
      return <FAQ2 onNavigate={() => handleNavClick('faq')} />;
    case 'feedback':
      return <PatientFeedback />;
    case 'contact':
      return <ContactUs />;
    default:
      return <Home />;
  }
};

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <button 
              onClick={() => handleNavClick('home')}
              className="flex items-center space-x-2 hover:opacity-80 transition"
            >
              <img 
                src="/timefly_logo.png" 
                alt="TimeFly Logo" 
                className="h-12 w-auto"
              />
              <span className="text-2xl font-bold text-blue-500">TimeFly</span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => handleNavClick('appointments')}
                className={`font-medium transition pb-2 ${
                  currentPage === 'appointments' 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-700 hover:text-indigo-600'
                }`}
              >
                Appointments
              </button>
              <button
                onClick={() => handleNavClick('queue')}
                className={`font-medium transition pb-2 ${
                  currentPage === 'queue' 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-700 hover:text-indigo-600'
                }`}
              >
                Queue
              </button>
              <button
                onClick={() => handleNavClick('about')}
                className={`font-medium transition pb-2 ${
                  currentPage === 'about' 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-700 hover:text-indigo-600'
                }`}
              >
                About Us
              </button>
              <button
                onClick={() => handleNavClick('doctors')}
                className={`font-medium transition pb-2 ${
                  currentPage === 'doctors' 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-700 hover:text-indigo-600'
                }`}
              >
                Our Doctors
              </button>
              <button
                onClick={() => handleNavClick('faq')}
                className={`font-medium transition pb-2 ${
                  currentPage === 'faq' 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-700 hover:text-indigo-600'
                }`}
              >
                FAQ
              </button>
              <button
                onClick={() => handleNavClick('feedback')}
                className={`font-medium transition pb-2 ${
                  currentPage === 'feedback' 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-700 hover:text-indigo-600'
                }`}
              >
                Feedback
              </button>
                <button
                onClick={() => handleNavClick('contact')}
                className={`font-medium transition pb-2 ${
                  currentPage === 'contact' 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-700 hover:text-indigo-600'
                }`}
              >
                Contact Support
              </button>
              
              {/* Desktop Profile Dropdown */}
              <div className="relative" ref={desktopDropdownRef}>
                <button
                  onClick={() => setIsDesktopDropdownOpen(!isDesktopDropdownOpen)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  {profilePhoto ? (
                    <img 
                      src={profilePhoto} 
                      alt="Profile" 
                      className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold border-2 border-indigo-600">
                      {getInitials(userEmail, userName)}
                    </div>
                  )}
                  <svg 
                    className={`w-4 h-4 text-gray-700 transition-transform ${isDesktopDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDesktopDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="p-4 bg-blue-700 text-white">
                      <div className="flex items-center space-x-3">
                        {profilePhoto ? (
                          <img 
                            src={profilePhoto} 
                            alt="Profile" 
                            className="h-16 w-16 rounded-full object-cover border-2 border-white"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold border-2 border-white">
                            {getInitials(userEmail, userName)}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{displayName}</p>
                          <p className="text-sm text-white/90 truncate">{userEmail}</p>
                        </div>
                      </div>
                    </div>

                    <div className="py-2">
                      <button
                        onClick={handleChangePhotoClick}
                        className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-100 flex items-center space-x-3 transition"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Change Photo</span>
                      </button>

                      <div className="border-t border-gray-200 my-2"></div>

                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center space-x-3 transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          {/* Mobile Profile and Menu */}
          <div className="md:hidden flex items-center space-x-3">
            <div className="relative" ref={mobileDropdownRef}>
              <button
                onClick={() => {
                  setIsMobileDropdownOpen(!isMobileDropdownOpen);
                  // Close mobile menu when profile dropdown is opened
                  if (isMobileMenuOpen) {
                    setIsMobileMenuOpen(false);
                  }
                }}
                className="flex items-center focus:outline-none"
              >
                {profilePhoto ? (
                  <img 
                    src={profilePhoto} 
                    alt="Profile" 
                    className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold border-2 border-indigo-600">
                    {getInitials(userEmail, userName)}
                  </div>
                )}
              </button>

              {isMobileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl overflow-hidden z-50">
                  <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                    <div className="flex items-center space-x-3">
                      {profilePhoto ? (
                        <img 
                          src={profilePhoto} 
                          alt="Profile" 
                          className="h-16 w-16 rounded-full object-cover border-2 border-white"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold border-2 border-white">
                          {getInitials(userEmail, userName)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{displayName}</p>
                        <p className="text-sm text-white/90 truncate">{userEmail}</p>
                      </div>
                    </div>
                  </div>

                  <div className="py-2">
                    <button
                      onClick={handleChangePhotoClick}
                      className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-100 flex items-center space-x-3 transition"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Change Photo</span>
                    </button>

                    <div className="border-t border-gray-200 my-2"></div>

                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center space-x-3 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />

            <div ref={hamburgerButtonRef}>
              <button 
                onClick={() => {
                  setIsMobileMenuOpen(prev => !prev);
                  setIsMobileDropdownOpen(false);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                {isMobileMenuOpen ? (
                  <svg 
                    className="w-6 h-6 text-gray-700" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg 
                    className="w-6 h-6 text-gray-700" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div ref={mobileMenuRef} className="md:hidden pb-4 bg-white rounded-b-lg shadow-lg">
              <div className="flex flex-col space-y-1 p-2">
                <button
                  onClick={() => handleNavClick('appointments')}
                  className={`font-medium transition py-3 px-4 text-left rounded ${
                    currentPage === 'appointments' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Appointments
                </button>
                <button
                  onClick={() => handleNavClick('queue')}
                  className={`font-medium transition py-3 px-4 text-left rounded ${
                    currentPage === 'queue' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Queue
                </button>
                <button
                  onClick={() => handleNavClick('about')}
                  className={`font-medium transition py-3 px-4 text-left rounded ${
                    currentPage === 'about' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  About Us
                </button>
                <button
                  onClick={() => handleNavClick('doctors')}
                  className={`font-medium transition py-3 px-4 text-left rounded ${
                    currentPage === 'doctors' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Our Doctors
                </button>
                <button
                  onClick={() => handleNavClick('faq')}
                  className={`font-medium transition py-3 px-4 text-left rounded ${
                    currentPage === 'faq' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  FAQ
                </button>
                <button
                  onClick={() => handleNavClick('feedback')}
                  className={`font-medium transition py-3 px-4 text-left rounded ${
                    currentPage === 'feedback' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Feedback
                </button>
                <button
                  onClick={() => handleNavClick('contact')}
                  className={`font-medium transition py-3 px-4 text-left rounded ${
                    currentPage === 'contact' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Page Content */}
      <div className="flex-1 pt-20">
        {renderPage()}
      </div>
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><button onClick={() => setCurrentPage('appointments')} className="text-gray-400 hover:text-white transition">Appointments</button></li>
                <li><button onClick={() => setCurrentPage('about')} className="text-gray-400 hover:text-white transition">About Us</button></li>
                <li><button onClick={() => setCurrentPage('doctors')} className="text-gray-400 hover:text-white transition">Our Doctors</button></li>
                <li><button onClick={() => setCurrentPage('faq')} className="text-gray-400 hover:text-white transition">FAQ</button></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-4">Help & Feedback</h3>
              <ul className="space-y-2">
                <li><button onClick={() => setCurrentPage('feedback')} className="text-gray-400 hover:text-white transition">Give Feedback</button></li>
                  <li><button onClick={() => setCurrentPage('contact')} className="text-gray-400 hover:text-white transition">Contact Support</button></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-4">Contact</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Email: timefly.healthcare@gmail.com</li>
                <li>Phone: 0909 400 6245</li>
                <li>Address: Ground Floor Saint Paul Surigao University Hospital, Km. 4 National Highway, Surigao City, Philippines</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col items-center">
            {/* Centered Logo + Title Block - Side by Side */}
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <img 
                  src="/timefly_logo.png" 
                  alt="TimeFly Logo" 
                  className="h-8 w-auto brightness-0 invert"
                />
                <span className="text-xl font-bold text-white">TimeFly</span>
              </div>
              <p className="text-gray-400 text-sm text-center">
                Clinic Scheduling and Queue Management
              </p>
            </div>
            
            <p className="text-gray-400 text-sm">
              © 2025 TimeFly. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;