import { useState, useRef, useEffect } from 'react';
import StaffHome from './StaffHome';
import StaffAppointments from './StaffAppointments';
import StaffQueue from './StaffQueue';
import DoctorsTab from './DoctorsTab';
import CalendarTab from './CalendarTab';
import DisplayFeedback from './DisplayFeedback'; 
import ContactMessagesTab from './ContactMessagesTab';
import WaitingList from './WaitingList';
import Reports from './Reports';
import UserManagement from './UserManagement'; 

interface StaffDashboardProps {
  userEmail: string;
  userName?: string;
  userPhoto?: string;
  onLogout: () => void;
}

type PageType = 'home' | 'appointments' | 'queue' | 'doctors' | 'calendar' | 'reports' | 'waiting-list' | 'feedback' | 'contact-messages' | 'user-management';

const StaffDashboard = ({ userEmail, userName, userPhoto, onLogout }: StaffDashboardProps) => {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string>(userPhoto || '');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  const displayName = userName || 'Staff';

  const handleHomeClick = () => {
    setCurrentPage('home');
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const handleNavClick = (page: PageType) => {
    setCurrentPage(page);
    if (window.innerWidth < 1024) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };
const renderPage = () => {
  switch (currentPage) {
    case 'home':
      return <StaffHome onNavigate={handleNavClick} />;
    case 'appointments':
      return <StaffAppointments />;
    case 'queue':
      return <StaffQueue />;
    case 'doctors':
      return <DoctorsTab />;
    case 'calendar':
      return <CalendarTab />;
    case 'feedback':
      return <DisplayFeedback />;
    case 'contact-messages':
      return <ContactMessagesTab />;
    case 'reports':
      return <Reports />;
    case 'waiting-list':
      return <WaitingList />;
    case 'user-management':  // ADD THIS CASE
      return <UserManagement />;
    default:
      return <StaffHome onNavigate={handleNavClick} />;
  }
};
const navItems = [
    { id: 'home', label: 'Dashboard', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { id: 'appointments', label: 'Appointments', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { id: 'queue', label: 'Queue', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    )},
    { id: 'doctors', label: 'Doctors', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
    { id: 'calendar', label: 'Calendar', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { id: 'reports', label: 'Reports', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { id: 'waiting-list', label: 'Waiting List', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { id: 'user-management', label: 'User Management', icon: (  // ADD THIS NEW ITEM
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )},
    { id: 'feedback', label: 'Feedbacks', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )},
    { id: 'contact-messages', label: 'Patient Inquiries', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )}
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden transition-opacity duration-300"
          onClick={closeMobileMenu}
        />
      )}
      <div 
        ref={sidebarRef}
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white shadow-xl border-r border-gray-200
          transition-all duration-300 ease-in-out
          flex flex-col
          ${isSidebarOpen ? 'w-64' : 'w-16'}
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <img 
              src="/timefly_logo.png" 
              alt="TimeFly Logo" 
              className="h-8 w-auto flex-shrink-0"
            />
            <span className={`text-xl font-bold text-gray-900 transition-all duration-300 truncate ${
              isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            }`}>
              TimeFly
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition hidden lg:block flex-shrink-0"
          >
            <svg className={`w-5 h-5 text-gray-600 transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`} 
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={closeMobileMenu}
            className="p-2 rounded-lg hover:bg-gray-100 transition lg:hidden flex-shrink-0"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id as PageType)}
              className={`
                w-full flex items-center p-3 rounded-lg transition-all duration-200
                ${currentPage === item.id 
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }
                ${isSidebarOpen ? 'justify-start space-x-3' : 'justify-center'}
                group
              `}
              title={!isSidebarOpen ? item.label : ''}
            >
              <div className={`flex-shrink-0 ${currentPage === item.id ? 'text-indigo-600' : 'text-gray-500 group-hover:text-gray-700'}`}>
                {item.icon}
              </div>
              <span className={`font-medium transition-all duration-300 truncate ${
                isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
              }`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
        <div className="border-t border-gray-200 bg-white flex-shrink-0">
          <div className={`p-4 ${isSidebarOpen ? 'space-y-3' : 'space-y-2'}`}>
            <div className={`flex items-center ${isSidebarOpen ? 'space-x-3' : 'justify-center'}`}>
              {profilePhoto ? (
                <img 
                  src={profilePhoto} 
                  alt="Profile" 
                  className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600 flex-shrink-0"
                  onError={() => setProfilePhoto('')}
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold border-2 border-indigo-600 flex-shrink-0">
                  {getInitials(userEmail, userName)}
                </div>
              )}
              <div className={`min-w-0 transition-all duration-300 ${
                isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
              }`}>
                <p className="font-semibold text-gray-900 truncate text-sm">{displayName}</p>
                <p className="text-gray-500 text-xs truncate">{userEmail}</p>
              </div>
            </div>
            <div className={`transition-all duration-300 space-y-1 ${
              isSidebarOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
            }`}>
              <button
                onClick={handleChangePhotoClick}
                className="w-full text-left text-sm text-gray-600 hover:text-gray-900 p-2 rounded hover:bg-gray-100 transition"
              >
                Change Photo
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left text-sm text-red-600 hover:text-red-700 p-2 rounded hover:bg-red-50 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300">
        <header className="lg:hidden bg-white shadow-sm border-b border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button 
              onClick={handleHomeClick}
              className="flex items-center space-x-2"
            >
              <img 
                src="/timefly_logo.png" 
                alt="TimeFly Logo" 
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold text-gray-900">TimeFly</span>
            </button>
            <div className="flex items-center space-x-3">
              {profilePhoto ? (
                <img 
                  src={profilePhoto} 
                  alt="Profile" 
                  className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600"
                  onError={() => setProfilePhoto('')}
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold border-2 border-indigo-600">
                  {getInitials(userEmail, userName)}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoChange}
        className="hidden"
      />
    </div>
  );
};

export default StaffDashboard;