import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { onAuthStateChange, logoutUser } from './services/authService';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase/config';
import Dashboard from './components/Dashboard';
import StaffDashboard from './components/StaffDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import Error404 from './components/Error404';
import ToastNotification from './components/ToastNotification';
import type { ToastType } from './components/ToastNotification';

interface UserData {
  displayName: string;
  email: string;
  photoURL: string;
  role: 'patient' | 'staff' | 'doctor';
}

function AppContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'patient' | 'staff' | 'doctor' | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  // Refs to track authentication state changes
  const isInitialLoad = useRef(true);
  const hasShownLoginNotification = useRef(false);
  const isAuthenticating = useRef(false);

  // Show toast notification
  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, isVisible: true });
  };

  // Real-time user data subscription
  useEffect(() => {
    let unsubscribeUserData: (() => void) | undefined;

    const setupUserDataListener = async (userId: string) => {
      try {
        const userDocRef = doc(db, 'users', userId);
        
        // Set up real-time listener for user data changes
        unsubscribeUserData = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            const newRole = userData.role || 'patient';
            
            console.log('🔄 Real-time user data update detected:', userData);
            console.log('🎯 New role:', newRole, 'Previous role:', userRole);
            
            // Update user role if it changed
            if (userRole !== newRole) {
              console.log('🔄 Role changed! Updating from', userRole, 'to', newRole);
              setUserRole(newRole);
              
              // Update complete user data
              setUserData({
                displayName: userData.displayName || user?.displayName || 'User',
                email: userData.email || user?.email || '',
                photoURL: userData.photoURL || user?.photoURL || '',
                role: newRole
              });

              // Show role change notification ONLY if:
              // 1. User was already authenticated (not initial load)
              // 2. Previous role existed (role actually changed, not first time setting)
              if (!isInitialLoad.current && userRole && userRole !== newRole) {
                showToast(`Role updated to ${newRole}`, 'info');
              }
            } else {
              // Still update user data even if role didn't change
              setUserData(prev => prev ? {
                ...prev,
                displayName: userData.displayName || prev.displayName,
                photoURL: userData.photoURL || prev.photoURL
              } : prev);
            }
          } else {
            console.log('⚠️ User document no longer exists');
            setUserRole('patient');
            setUserData(prev => prev ? { ...prev, role: 'patient' } : null);
          }
        }, (error) => {
          console.error('❌ Error in user data listener:', error);
        });

      } catch (error) {
        console.error('❌ Error setting up user data listener:', error);
      }
    };

    const unsubscribeAuth = onAuthStateChange(async (user) => {
      if (isSigningUp) {
        console.log('🔄 Ignoring auth change during signup');
        return;
      }

      if (user) {
        // Check sessionStorage to see if we've already shown login notification this session
        const sessionKey = `login_notified_${user.uid}`;
        const hasNotifiedThisSession = sessionStorage.getItem(sessionKey) === 'true';
        
        console.log('🔐 Auth state change:', {
          userId: user.uid,
          hasNotifiedThisSession,
          sessionStorageKey: sessionKey
        });

        // Set role loading to true before fetching
        setRoleLoading(true);
        setUser(user);
        isAuthenticating.current = true;
        
        try {
          console.log('🔍 Fetching initial user data for:', user.uid);
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role || 'patient';
            
            console.log('✅ Initial user data fetched:', userData);
            console.log('🎯 Initial user role detected:', role);
            setUserRole(role);
            
            // Store complete user data including name and photo
            setUserData({
              displayName: userData.displayName || user.displayName || 'User',
              email: userData.email || user.email || '',
              photoURL: userData.photoURL || user.photoURL || '',
              role: role
            });
            
            // Set up real-time listener for future role changes
            await setupUserDataListener(user.uid);
            
            // Show notification ONLY if we haven't notified this session
            if (!hasNotifiedThisSession) {
              console.log('🔔 Showing login notification for first time this session');
              if (role === 'staff') {
                showToast('Staff authenticated successfully!', 'success');
              } else if (role === 'doctor') {
                showToast('Doctor authenticated successfully!', 'success');
              } else {
                const displayName = userData.displayName || user.displayName || 'User';
                showToast(`Welcome back, ${displayName}!`, 'success');
              }
              // Mark as notified in sessionStorage
              sessionStorage.setItem(sessionKey, 'true');
              hasShownLoginNotification.current = true;
            } else {
              console.log('🔕 Skipping notification - already shown this session');
            }
          } else {
            console.log('⚠️ No user document found, defaulting to patient');
            setUserRole('patient');
            
            // Set user data with fallbacks
            setUserData({
              displayName: user.displayName || 'User',
              email: user.email || '',
              photoURL: user.photoURL || '',
              role: 'patient'
            });
            
            // Only show welcome message on first time this session
            if (!hasNotifiedThisSession) {
              console.log('🔔 Showing welcome notification for new user');
              showToast('Welcome! Setting up your account...', 'info');
              sessionStorage.setItem(sessionKey, 'true');
              hasShownLoginNotification.current = true;
            }
          }
        } catch (error) {
          console.error('❌ Error fetching user data:', error);
          setUserRole('patient');
          
          // Set fallback user data on error
          setUserData({
            displayName: user.displayName || 'User',
            email: user.email || '',
            photoURL: user.photoURL || '',
            role: 'patient'
          });
          
          // Only show error on first time this session
          if (!hasNotifiedThisSession) {
            console.log('🔔 Showing error notification');
            showToast('Error loading profile. Defaulting to patient view.', 'error');
            sessionStorage.setItem(sessionKey, 'true');
            hasShownLoginNotification.current = true;
          }
        } finally {
          // Set both loading states to false
          setRoleLoading(false);
          setLoading(false);
          isInitialLoad.current = false;
          isAuthenticating.current = false;
        }
      } else {
        // No user logged in - cleanup listeners and reset state
        console.log('👤 User logged out - resetting state');
        
        if (unsubscribeUserData) {
          unsubscribeUserData();
        }
        
        setUser(null);
        setUserRole(null);
        setUserData(null);
        setRoleLoading(false);
        setLoading(false);
        
        // Reset tracking refs
        hasShownLoginNotification.current = false;
        isInitialLoad.current = true;
        
        // Clear sessionStorage on logout to allow notification on next login
        // Clear all login notification flags
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('login_notified_')) {
            sessionStorage.removeItem(key);
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserData) {
        unsubscribeUserData();
      }
    };
  }, [isSigningUp]); // Only depend on isSigningUp

  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out user');
      
      // Clear sessionStorage notification flag before logout
      if (user?.uid) {
        const sessionKey = `login_notified_${user.uid}`;
        sessionStorage.removeItem(sessionKey);
      }
      
      await logoutUser();
      
      // Reset all state
      setUser(null);
      setUserRole(null);
      setUserData(null);
      
      // Reset tracking refs
      hasShownLoginNotification.current = false;
      isInitialLoad.current = true;
      
      showToast('Logged out successfully', 'info');
      
      // Navigate to login after logout
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Error logging out. Please try again.', 'error');
    }
  };

  const handleSignupSuccess = () => {
    setIsSigningUp(false);
    
    // Show success toast on login page
    showToast('Account created successfully! Please sign in.', 'success');
    
    // Navigate to login
    navigate('/login');
  };

  const handleSwitchToLogin = () => {
    navigate('/login');
  };

  const handleSwitchToSignup = () => {
    navigate('/signup');
  };

  // Role-based access control helper
  const hasAccessToRoute = (requiredRole: string | string[]): boolean => {
    if (!userRole) return false;
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(userRole);
    }
    
    return userRole === requiredRole;
  };

  // Show loading screen if either loading or roleLoading is true
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

  // Render the appropriate dashboard based on current user role
  const renderDashboard = () => {
    if (!user || !userRole || !userData) {
      console.log('🚫 No user data, redirecting to login');
      return <Navigate to="/login" replace />;
    }

    console.log('🎯 Rendering dashboard for role:', userRole);
    
    switch (userRole) {
      case 'staff':
        console.log('👨‍💼 Rendering StaffDashboard');
        return (
          <StaffDashboard 
            userEmail={userData.email} 
            userName={userData.displayName}
            userPhoto={userData.photoURL}
            onLogout={handleLogout} 
          />
        );
      case 'doctor':
        console.log('👨‍⚕️ Rendering DoctorDashboard');
        return (
          <DoctorDashboard 
            userEmail={userData.email} 
            userName={userData.displayName}
            userPhoto={userData.photoURL}
            onLogout={handleLogout} 
          />
        );
      case 'patient':
      default:
        console.log('👤 Rendering Patient Dashboard');
        return (
          <Dashboard 
            userEmail={userData.email} 
            userName={userData.displayName}
            userPhoto={userData.photoURL}
            onLogout={handleLogout} 
          />
        );
    }
  };

  // Helper function to determine redirect path based on current role
  const getRedirectPath = () => {
    if (!userRole) return '/login';
    
    switch (userRole) {
      case 'doctor':
        return '/doctor';
      case 'staff':
        return '/staff';
      case 'patient':
      default:
        return '/';
    }
  };

  return (
    <>
      {/* Global Toast Notification */}
      <ToastNotification
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
      
      <Routes>
        {/* Public routes - redirect to appropriate dashboard if already logged in */}
        <Route 
          path="/login" 
          element={
            !user ? (
              <Login onSwitchToSignup={handleSwitchToSignup} />
            ) : (
              <Navigate to={getRedirectPath()} replace />
            )
          } 
        />
        
        <Route 
          path="/signup" 
          element={
            !user ? (
              <Signup 
                onSignup={handleSignupSuccess}
                onSwitchToLogin={handleSwitchToLogin}
                onSignupStart={() => setIsSigningUp(true)}
              />
            ) : (
              <Navigate to={getRedirectPath()} replace />
            )
          } 
        />
        
        {/* Main dashboard route - handles all roles appropriately */}
        <Route 
          path="/" 
          element={renderDashboard()}
        />
        
        {/* Doctor-specific route with role protection */}
        <Route 
          path="/doctor" 
          element={
            user && userRole ? (
              hasAccessToRoute('doctor') ? (
                <DoctorDashboard 
                  userEmail={userData?.email || ''} 
                  userName={userData?.displayName || ''}
                  userPhoto={userData?.photoURL || ''}
                  onLogout={handleLogout} 
                />
              ) : (
                (() => {
                  console.log('🚫 Non-doctor accessing /doctor, current role:', userRole);
                  return <Navigate to="/404" replace />;
                })()
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Staff-specific route with role protection */}
        <Route 
          path="/staff" 
          element={
            user && userRole ? (
              hasAccessToRoute('staff') ? (
                <StaffDashboard 
                  userEmail={userData?.email || ''} 
                  userName={userData?.displayName || ''}
                  userPhoto={userData?.photoURL || ''}
                  onLogout={handleLogout} 
                />
              ) : (
                (() => {
                  console.log('🚫 Non-staff accessing /staff, current role:', userRole);
                  return <Navigate to="/404" replace />;
                })()
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Patient-specific route with role protection */}
        <Route 
          path="/patient" 
          element={
            user && userRole ? (
              hasAccessToRoute('patient') ? (
                <Dashboard 
                  userEmail={userData?.email || ''} 
                  userName={userData?.displayName || ''}
                  userPhoto={userData?.photoURL || ''}
                  onLogout={handleLogout} 
                />
              ) : (
                (() => {
                  console.log('🚫 Non-patient accessing /patient, current role:', userRole);
                  return <Navigate to="/404" replace />;
                })()
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        {/* 404 Error Page */}
        <Route 
          path="/404" 
          element={<Error404 />}
        />
        
        {/* Fallback route - redirect to 404 */}
        <Route 
          path="*" 
          element={<Error404 />}
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;