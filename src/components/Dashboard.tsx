import { useState, useRef, useEffect } from 'react';
import Home from './Home';
import AboutUs from './AboutUs';
import OurDoctors from './OurDoctors';
import FAQ from './FAQ';
import Feedbacks from './Feedbacks';
import Appointments from './Appointments';
import Queue from './Queue';

interface DashboardProps {
  userEmail: string;
  userName?: string;
  userPhoto?: string;
  onLogout: () => void;
}

type PageType = 'home' | 'appointments' | 'queue' | 'about' | 'doctors' | 'faq' | 'feedbacks';

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

  useEffect(() => {
    if (userPhoto) {
      setProfilePhoto(userPhoto);
    }
  }, [userPhoto]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
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
      if (desktopDropdownRef.current && !desktopDropdownRef.current.contains(event.target as Node)) {
        setIsDesktopDropdownOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)) {
        setIsMobileDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
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
        return <FAQ />;
      case 'feedbacks':
        return <Feedbacks />;
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
              <span className="text-2xl font-bold text-gray-900">TimeFly</span>
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
                onClick={() => handleNavClick('feedbacks')}
                className={`font-medium transition pb-2 ${
                  currentPage === 'feedbacks' 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-700 hover:text-indigo-600'
                }`}
              >
                Feedbacks
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
            </div>

            {/* Mobile Profile and Menu */}
            <div className="md:hidden flex items-center space-x-3">
              <div className="relative" ref={mobileDropdownRef}>
                <button
                  onClick={() => setIsMobileDropdownOpen(!isMobileDropdownOpen)}
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

              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
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
                  onClick={() => handleNavClick('feedbacks')}
                  className={`font-medium transition py-3 px-4 text-left rounded ${
                    currentPage === 'feedbacks' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Feedbacks
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <img 
                  src="/timefly_logo.png" 
                  alt="TimeFly Logo" 
                  className="h-8 w-auto brightness-0 invert"
                />
              </div>
              <p className="text-gray-400 text-sm">
                Real-time healthcare access for everyone, everywhere.
              </p>
            </div>

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
              <h3 className="font-semibold text-lg mb-4">Support</h3>
              <ul className="space-y-2">
                <li><button onClick={() => setCurrentPage('faq')} className="text-gray-400 hover:text-white transition">FAQ</button></li>
                <li><button onClick={() => setCurrentPage('feedbacks')} className="text-gray-400 hover:text-white transition">Feedbacks</button></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white transition">Contact Us</a></li>
                <li><a href="#privacy" className="text-gray-400 hover:text-white transition">Privacy Policy</a></li>
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
            <p className="text-gray-400 text-sm mb-4">
              © 2024 TimeFly. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="https://facebook.com/timefly" className="text-gray-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="mailto:timefly.healthcare@gmail.com" className="text-gray-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </a>
              <a href="https://instagram.com/timefly" className="text-gray-400 hover:text-white transition">
               <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;