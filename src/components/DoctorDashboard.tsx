import {  useState } from 'react';
import DoctorHeader from './DoctorHeader';
import Footer from './Footer';
import DoctorHome from './DoctorHome';
import DoctorAppointment from './DoctorAppointment';
import DoctorQueue from './DoctorQueue';

type View = 'home' | 'appointments' | 'queue';

interface DoctorDashboardProps {
  userEmail: string;
  userName: string;
  userPhoto: string;
  onLogout: () => void;
}

const DoctorDashboard = ({ userEmail, userName, userPhoto, onLogout }: DoctorDashboardProps) => {
  // Debug: Check what props are being received
  console.log('🔍 DoctorDashboard received props:', { 
    userEmail, 
    userName, 
    userPhoto,
    emailLength: userEmail?.length,
    emailType: typeof userEmail
  });
  
  const [currentView, setCurrentView] = useState<View>('home');
  const [profilePhoto, setProfilePhoto] = useState(userPhoto);
  // Add Christmas theme state
  const [isChristmasTheme, setIsChristmasTheme] = useState(false);
  
  // Extract doctor name from userName (remove "Dr." prefix if present)
  const doctorName = userName.replace(/^Dr\.\s*/i, '');

  // Add Christmas theme toggle function
  const handleToggleChristmasTheme = () => {
    setIsChristmasTheme(prev => !prev);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'home':
        return (
          <DoctorHome
            doctorName={doctorName}
            onNavigateToAppointments={() => setCurrentView('appointments')}
            onNavigateToQueue={() => setCurrentView('queue')}
            isChristmasTheme={isChristmasTheme} // Pass Christmas theme to DoctorHome
          />
        );
      case 'appointments':
       return (
         <DoctorAppointment 
           doctorName={doctorName} 
           isChristmasTheme={isChristmasTheme} // Pass Christmas theme to DoctorAppointment
         />
       );
      case 'queue':
        return (
          <DoctorQueue 
            doctorName={doctorName} 
            isChristmasTheme={isChristmasTheme} // Pass Christmas theme to DoctorQueue
          />
        );
      default:
        return (
          <DoctorHome
            doctorName={doctorName}
            onNavigateToAppointments={() => setCurrentView('appointments')}
            onNavigateToQueue={() => setCurrentView('queue')}
            isChristmasTheme={isChristmasTheme} // Pass Christmas theme to default view
          />
        );
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${isChristmasTheme ? 'bg-gradient-to-br from-red-50 to-green-50' : 'bg-gray-50'}`}>
      <DoctorHeader
        doctorName={`Dr. ${doctorName}`}
        username={userEmail?.split('@')[0] || 'user'}
        profilePhoto={profilePhoto}
        userEmail={userEmail || 'No email provided'}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={onLogout}
        onPhotoChange={setProfilePhoto}
        // Add Christmas theme props
        onToggleChristmasTheme={handleToggleChristmasTheme}
        isChristmasTheme={isChristmasTheme}
      />
      
      <main className="flex-1">
        {renderCurrentView()}
      </main>
      
      <Footer />
    </div>
  );
};

export default DoctorDashboard;