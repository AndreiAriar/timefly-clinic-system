import { useState } from 'react';
import DoctorHeader from './doctorheader';
import Footer from './footer';
import DoctorHome from './doctorhome';
import DoctorAppointments from './appointments';
import DoctorQueue from './queue';

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
  
  // Extract doctor name from userName (remove "Dr." prefix if present)
  const doctorName = userName.replace(/^Dr\.\s*/i, '');

  const renderCurrentView = () => {
    switch (currentView) {
      case 'home':
        return (
          <DoctorHome
            doctorName={doctorName}
            onNavigateToAppointments={() => setCurrentView('appointments')}
            onNavigateToQueue={() => setCurrentView('queue')}
          />
        );
      case 'appointments':
        return <DoctorAppointments doctorName={doctorName} />;
      case 'queue':
        return <DoctorQueue doctorName={doctorName} />;
      default:
        return (
          <DoctorHome
            doctorName={doctorName}
            onNavigateToAppointments={() => setCurrentView('appointments')}
            onNavigateToQueue={() => setCurrentView('queue')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DoctorHeader
        doctorName={`Dr. ${doctorName}`}
        username={userEmail?.split('@')[0] || 'user'}
        profilePhoto={profilePhoto}
        userEmail={userEmail || 'No email provided'}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={onLogout}
        onPhotoChange={setProfilePhoto}
      />
      
      <main className="flex-1">
        {renderCurrentView()}
      </main>
      
      <Footer />
    </div>
  );
};

export default DoctorDashboard;