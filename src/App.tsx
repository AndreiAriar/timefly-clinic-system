
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { onAuthStateChange, logoutUser } from './services/authService';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase/config';
import TermsOfUse from './components/TermsOfUse';
import PrivacyPolicy from './components/PrivacyPolicy';

// Lazy load components for better performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const StaffDashboard = lazy(() => import('./components/StaffDashboard'));
const DoctorDashboard = lazy(() => import('./components/DoctorDashboard'));
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const Error404 = lazy(() => import('./components/Error404'));
const ToastNotification = lazy(() => import('./components/ToastNotification'));

interface UserData {
  displayName: string;
  email: string;
  photoURL: string;
  role: 'patient' | 'staff' | 'doctor';
}

interface ToastType {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  isVisible: boolean;
}

// Fast-loading authentication spinner
const AuthSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Authenticating...</p>
    </div>
  </div>
);

// Ultra-minimal loading component - just a subtle background
const MinimalLoader = () => (
  <div className="min-h-screen bg-gray-50 transition-opacity duration-200" />
);

function AppContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'patient' | 'staff' | 'doctor' | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [toast, setToast] = useState<ToastType>({
    message: '',
    type: 'info',
    isVisible: false
  });

  // Refs to track authentication state changes
  const isInitialLoad = useRef(true);
  const hasShownLoginNotification = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Memoized toast function to prevent unnecessary re-renders
  const showToast = useCallback((message: string, type: ToastType['type']) => {
    setToast({ message, type, isVisible: true });
  }, []);

  // Memoized user data listener setup
  const setupUserDataListener = useCallback(async (userId: string) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      
      // Set up real-time listener for user data changes
      unsubscribeRef.current = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const newRole = userData.role || 'patient';
          
          // Update user role if it changed
          setUserRole(prevRole => {
            if (prevRole !== newRole) {
              console.log('🔄 Role changed! Updating from', prevRole, 'to', newRole);
              
              // Update complete user data
              setUserData(prev => prev ? {
                ...prev,
                displayName: userData.displayName || prev.displayName,
                photoURL: userData.photoURL || prev.photoURL,
                role: newRole
              } : null);

              // Show role change notification ONLY if not initial load
              if (!isInitialLoad.current && prevRole) {
                showToast(`Role updated to ${newRole}`, 'info');
              }
              return newRole;
            }
            return prevRole;
          });

          // Update user data even if role didn't change
          setUserData(prev => prev ? {
            ...prev,
            displayName: userData.displayName || prev.displayName,
            photoURL: userData.photoURL || prev.photoURL
          } : prev);
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
  }, [showToast]);

  // Optimized auth state change handler - no artificial delays
  const handleAuthStateChange = useCallback(async (user: User | null) => {
    if (isSigningUp) {
      return;
    }

    if (user) {
      // Check sessionStorage to see if we've already shown login notification this session
      const sessionKey = `login_notified_${user.uid}`;
      const hasNotifiedThisSession = sessionStorage.getItem(sessionKey) === 'true';
      
      setUser(user);
      
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role || 'patient';
          
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
            if (role === 'staff') {
              showToast('Staff authenticated successfully!', 'success');
            } else if (role === 'doctor') {
              showToast('Doctor authenticated successfully!', 'success');
            } else {
              const displayName = userData.displayName || user.displayName || 'User';
              showToast(`Welcome back, ${displayName}!`, 'success');
            }
            sessionStorage.setItem(sessionKey, 'true');
            hasShownLoginNotification.current = true;
          }
        } else {
          setUserRole('patient');
          setUserData({
            displayName: user.displayName || 'User',
            email: user.email || '',
            photoURL: user.photoURL || '',
            role: 'patient'
          });
          
          if (!hasNotifiedThisSession) {
            showToast('Welcome! Setting up your account...', 'info');
            sessionStorage.setItem(sessionKey, 'true');
            hasShownLoginNotification.current = true;
          }
        }
      } catch (error) {
        console.error('❌ Error fetching user data:', error);
        setUserRole('patient');
        setUserData({
          displayName: user.displayName || 'User',
          email: user.email || '',
          photoURL: user.photoURL || '',
          role: 'patient'
        });
        
        if (!hasNotifiedThisSession) {
          showToast('Error loading profile. Defaulting to patient view.', 'error');
          sessionStorage.setItem(sessionKey, 'true');
          hasShownLoginNotification.current = true;
        }
      } finally {
        // IMMEDIATE loading completion - no delays
        setLoading(false);
        isInitialLoad.current = false;
      }
    } else {
      // No user logged in - cleanup listeners and reset state
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      setUser(null);
      setUserRole(null);
      setUserData(null);
      
      // IMMEDIATE state reset - no delays
      setLoading(false);

      // Reset tracking refs
      hasShownLoginNotification.current = false;
      isInitialLoad.current = true;
      
      // Clear sessionStorage on logout
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('login_notified_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, [isSigningUp, setupUserDataListener, showToast]);


useEffect(() => {
  // Disable all transitions on mount
  document.body.style.transition = 'none';
  document.documentElement.style.transition = 'none';
  
  // Force repaint
  void document.body.offsetHeight;
}, []);

  // Optimized auth state subscription
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChange(handleAuthStateChange);
    return () => {
      unsubscribeAuth();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [handleAuthStateChange]);

  const handleLogout = useCallback(async () => {
    try {
      // Clear sessionStorage notification flag before logout
      if (user?.uid) {
        const sessionKey = `login_notified_${user.uid}`;
        sessionStorage.removeItem(sessionKey);
      }
      
      await logoutUser();
      
      // Reset all state immediately
      setUser(null);
      setUserRole(null);
      setUserData(null);
      
      // Reset tracking refs
      hasShownLoginNotification.current = false;
      isInitialLoad.current = true;
      
      showToast('Logged out successfully', 'info');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Error logging out. Please try again.', 'error');
    }
  }, [user, showToast, navigate]);

  const handleSignupSuccess = useCallback(() => {
    setIsSigningUp(false);
    showToast('Account created successfully! Please sign in.', 'success');
    navigate('/login');
  }, [showToast, navigate]);

  const handleSwitchToLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  const handleSwitchToSignup = useCallback(() => {
    navigate('/signup');
  }, [navigate]);

  // Memoized role-based access control helper
  const hasAccessToRoute = useCallback((requiredRole: string | string[]): boolean => {
    if (!userRole) return false;
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(userRole);
    }
    
    return userRole === requiredRole;
  }, [userRole]);

  // Memoized redirect path helper
  const getRedirectPath = useCallback(() => {
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
  }, [userRole]);

  // Memoized dashboard renderer
  const renderDashboard = useCallback(() => {
    if (!user || !userRole || !userData) {
      return <Navigate to="/login" replace />;
    }
    
    const dashboardProps = {
      userEmail: userData.email,
      userName: userData.displayName,
      userPhoto: userData.photoURL,
      onLogout: handleLogout
    };
    
    switch (userRole) {
      case 'staff':
        return <StaffDashboard {...dashboardProps} />;
      case 'doctor':
        return <DoctorDashboard {...dashboardProps} />;
      case 'patient':
      default:
        return <Dashboard {...dashboardProps} />;
    }
  }, [user, userRole, userData, handleLogout]);

  // Show authentication spinner during initial auth check
  if (loading && isInitialLoad.current) {
    return <AuthSpinner />;
  }

  // Main app content - renders immediately once auth is determined
  return (
    <>
      {/* Global Toast Notification */}
      <Suspense fallback={null}>
        <ToastNotification
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
        />
      </Suspense>
      
       <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            !user ? (
              <Suspense fallback={<MinimalLoader />}>
                <Login onSwitchToSignup={handleSwitchToSignup} />
              </Suspense>
            ) : (
              <Navigate to={getRedirectPath()} replace />
            )
          } 
        />
        
        <Route 
          path="/signup" 
          element={
            !user ? (
              <Suspense fallback={<MinimalLoader />}>
                <Signup 
                  onSignup={handleSignupSuccess}
                  onSwitchToLogin={handleSwitchToLogin}
                  onSignupStart={() => setIsSigningUp(true)}
                />
              </Suspense>
            ) : (
              <Navigate to={getRedirectPath()} replace />
            )
          } 
        />
        
        {/* Terms and Privacy routes - ADDED */}
        <Route 
          path="/terms-of-use" 
          element={
            <Suspense fallback={<MinimalLoader />}>
              <TermsOfUse />
            </Suspense>
          } 
        />
        
        <Route 
          path="/privacy-policy" 
          element={
            <Suspense fallback={<MinimalLoader />}>
              <PrivacyPolicy />
            </Suspense>
          } 
        />
        
        {/* Main dashboard route */}
        <Route 
          path="/" 
          element={
            <Suspense fallback={<MinimalLoader />}>
              {renderDashboard()}
            </Suspense>
          }
        />
        
        {/* Role-specific routes */}
        <Route 
          path="/doctor" 
          element={
            user && userRole ? (
              hasAccessToRoute('doctor') ? (
                <Suspense fallback={<MinimalLoader />}>
                  <DoctorDashboard 
                    userEmail={userData?.email || ''} 
                    userName={userData?.displayName || ''}
                    userPhoto={userData?.photoURL || ''}
                    onLogout={handleLogout} 
                  />
                </Suspense>
              ) : (
                <Navigate to="/404" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route 
          path="/staff" 
          element={
            user && userRole ? (
              hasAccessToRoute('staff') ? (
                <Suspense fallback={<MinimalLoader />}>
                  <StaffDashboard 
                    userEmail={userData?.email || ''} 
                    userName={userData?.displayName || ''}
                    userPhoto={userData?.photoURL || ''}
                    onLogout={handleLogout} 
                  />
                </Suspense>
              ) : (
                <Navigate to="/404" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route 
          path="/patient" 
          element={
            user && userRole ? (
              hasAccessToRoute('patient') ? (
                <Suspense fallback={<MinimalLoader />}>
                  <Dashboard 
                    userEmail={userData?.email || ''} 
                    userName={userData?.displayName || ''}
                    userPhoto={userData?.photoURL || ''}
                    onLogout={handleLogout} 
                  />
                </Suspense>
              ) : (
                <Navigate to="/404" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        {/* 404 Error Page */}
        <Route 
          path="/404" 
          element={
            <Suspense fallback={<MinimalLoader />}>
              <Error404 />
            </Suspense>
          }
        />
        
        {/* Fallback route */}
        <Route 
          path="*" 
          element={
            <Suspense fallback={<MinimalLoader />}>
              <Error404 />
            </Suspense>
          }
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