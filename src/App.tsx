import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChange, logoutUser } from './services/authService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import Dashboard from './components/Dashboard';
import StaffDashboard from './components/StaffDashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type ViewType = 'login' | 'signup';

interface UserData {
  displayName: string;
  email: string;
  photoURL: string;
  role: 'patient' | 'staff';
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'patient' | 'staff' | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null); // ✅ NEW: Store complete user data
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('login');
  const [isSigningUp, setIsSigningUp] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (isSigningUp) {
        console.log('🔄 Ignoring auth change during signup');
        return;
      }

      if (user) {
        // ✅ Set role loading to true before fetching
        setRoleLoading(true);
        setUser(user);
        
        try {
          console.log('🔍 Fetching user data for:', user.uid);
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role || 'patient';
            
            console.log('✅ User data fetched:', userData);
            setUserRole(role);
            
            // ✅ NEW: Store complete user data including name and photo
            setUserData({
              displayName: userData.displayName || user.displayName || 'User',
              email: user.email || '',
              photoURL: userData.photoURL || user.photoURL || '',
              role: role
            });
            
            // ✅ Show notification for staff
            if (role === 'staff') {
              toast.success(' Staff authenticated successfully!', {
                position: "top-right",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              });
            } else {
              const displayName = userData.displayName || user.displayName || 'User';
              toast.success(`Welcome back, ${displayName}!`, {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              });
            }
          } else {
            console.log('⚠️ No user document found, defaulting to patient');
            setUserRole('patient');
            // ✅ NEW: Set user data with fallbacks
            setUserData({
              displayName: user.displayName || 'User',
              email: user.email || '',
              photoURL: user.photoURL || '',
              role: 'patient'
            });
            toast.info('Welcome! Setting up your account...', {
              position: "top-right",
              autoClose: 2000,
            });
          }
        } catch (error) {
          console.error('❌ Error fetching user data:', error);
          setUserRole('patient');
          // ✅ NEW: Set fallback user data on error
          setUserData({
            displayName: user.displayName || 'User',
            email: user.email || '',
            photoURL: user.photoURL || '',
            role: 'patient'
          });
          toast.error('Error loading profile. Defaulting to patient view.', {
            position: "top-right",
            autoClose: 3000,
          });
        } finally {
          // ✅ Set both loading states to false
          setRoleLoading(false);
          setLoading(false);
        }
      } else {
        // ✅ No user logged in
        setUser(null);
        setUserRole(null);
        setUserData(null); // ✅ NEW: Clear user data
        setRoleLoading(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [isSigningUp]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
      setUserRole(null);
      setUserData(null); // ✅ NEW: Clear user data
      setCurrentView('login');
      toast.info(' Logged out successfully', {
        position: "top-right",
        autoClose: 2000,
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out. Please try again.', {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  const handleSignupSuccess = () => {
    setIsSigningUp(false);
    setCurrentView('login');
  };

  // ✅ Show loading screen if either loading or roleLoading is true
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {roleLoading ? 'Authenticating...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // ✅ Only render dashboard when we have both user AND role confirmed
  return (
    <>
      {/* Toast Container for notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      {user && userRole && userData ? (
        // ✅ Only show dashboard when user, userRole, AND userData are confirmed
        userRole === 'staff' ? (
          <StaffDashboard 
            userEmail={userData.email} 
            userName={userData.displayName}
            userPhoto={userData.photoURL}
            onLogout={handleLogout} 
          />
        ) : (
          <Dashboard 
            userEmail={userData.email} 
            userName={userData.displayName}
            userPhoto={userData.photoURL}
            onLogout={handleLogout} 
          />
        )
      ) : (
        <>
          {currentView === 'login' ? (
            <Login onSwitchToSignup={() => setCurrentView('signup')} />
          ) : (
            <Signup 
              onSignup={handleSignupSuccess}
              onSwitchToLogin={() => setCurrentView('login')}
              onSignupStart={() => setIsSigningUp(true)}
            />
          )}
        </>
      )}
    </>
  );
}

export default App;