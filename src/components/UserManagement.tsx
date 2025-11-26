// src/components/admin/UserManagement.tsx
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, where, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CheckCircle, XCircle, Ban, RefreshCw } from 'lucide-react';

interface Appointment {
  id: string;
  email: string;
  status: string;
  appointmentDate: string;
}

interface UserStats {
  id: string;
  email: string;
  activeAppointments: number;
  totalBookings: number;
  noShowCount: number;
  cancelledBookings: number;
  isRestricted: boolean;
  restrictionReason?: string;
  restrictionUntil?: string;
  dailyAppointmentsCount?: number;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔥 Setting up real-time listeners for user management...');
    
    const unsubscribeAppointments: { current: (() => void) | undefined } = { current: undefined };
    const unsubscribeUsers: { current: (() => void) | undefined } = { current: undefined };
    
    // Store appointments data in component scope
    let appointmentsData: Appointment[] = [];
    
    // Function to calculate user stats
    const calculateUserStats = (usersSnapshot: QuerySnapshot<DocumentData>) => {
      // Create a Map to store unique users by email
      const uniqueUsersMap = new Map<string, UserStats>();
      
      // Get today's date for daily appointment limit check
      const today = new Date().toISOString().split('T')[0];
      
      usersSnapshot.docs.forEach((userDoc) => {
        const userData = userDoc.data();
        const userEmail = userData.email || userDoc.id;
        
        // Skip if we already processed this email
        if (uniqueUsersMap.has(userEmail)) {
          console.log(`⚠️ Duplicate email found: ${userEmail}, skipping document ${userDoc.id}`);
          return;
        }

        // Filter appointments for this user - ONLY COUNT ACTIVE ONES
        const userAppointments = appointmentsData.filter(apt => 
          apt.email === userEmail && 
          apt.status !== 'cancelled' && 
          apt.status !== 'completed' && 
          apt.status !== 'missed'
        );

        // Calculate daily appointments count for today
        const dailyAppointmentsCount = appointmentsData.filter(apt => 
          apt.email === userEmail && 
          apt.appointmentDate === today &&
          apt.status !== 'cancelled' && 
          apt.status !== 'completed' && 
          apt.status !== 'missed'
        ).length;

        // Calculate stats
        const activeAppointments = userAppointments.filter(apt => 
          apt.status === 'pending' || apt.status === 'confirmed' || apt.status === 'scheduled'
        ).length;

        const totalBookings = userAppointments.length;

        const noShowCount = appointmentsData.filter(apt => 
          apt.email === userEmail && apt.status === 'missed'
        ).length;

        const cancelledBookings = appointmentsData.filter(apt => 
          apt.email === userEmail && apt.status === 'cancelled'
        ).length;

        // Check if user should be automatically restricted based on daily limit
        const hasReachedDailyLimit = dailyAppointmentsCount >= 2;
        const isAutoRestricted = hasReachedDailyLimit || noShowCount >= 3;
        
        uniqueUsersMap.set(userEmail, {
          id: userDoc.id,
          email: userEmail,
          activeAppointments,
          totalBookings,
          noShowCount,
          cancelledBookings,
          dailyAppointmentsCount,
          isRestricted: userData.isRestricted || isAutoRestricted,
          restrictionReason: userData.restrictionReason || (hasReachedDailyLimit ? 'Daily appointment limit reached' : undefined),
          restrictionUntil: userData.restrictionUntil
        });
      });
      
      // Convert Map to Array
      const usersData = Array.from(uniqueUsersMap.values());
      
      // Sort by no-show count (highest first)
      usersData.sort((a, b) => b.noShowCount - a.noShowCount);
      
      setUsers(usersData);
      setLoading(false);
    };
    
    // Set up real-time listener for appointments
    const appointmentsRef = collection(db, 'staff_appointments');
    unsubscribeAppointments.current = onSnapshot(
      appointmentsRef,
      (snapshot) => {
        console.log('📊 Real-time update - Appointments:', snapshot.docs.length);
        
        appointmentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Appointment));
        
        // Fetch users after appointments are loaded
        const usersRef = collection(db, 'users');
        getDocs(usersRef).then(calculateUserStats);
      },
      (error) => {
        console.error('❌ Error in appointments listener:', error);
        setLoading(false);
      }
    );
    
    // Set up real-time listener for users
    const usersRef = collection(db, 'users');
    unsubscribeUsers.current = onSnapshot(
      usersRef,
      (snapshot) => {
        console.log('📊 Real-time update - Users:', snapshot.docs.length);
        calculateUserStats(snapshot);
      },
      (error) => {
        console.error('❌ Error in users listener:', error);
        setLoading(false);
      }
    );
    
    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up user management listeners');
      if (unsubscribeAppointments.current) {
        unsubscribeAppointments.current();
      }
      if (unsubscribeUsers.current) {
        unsubscribeUsers.current();
      }
    };
  }, []);

  const removeRestriction = async (userEmail: string) => {
    try {
      // Find user document by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', userEmail));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userRef = doc(db, 'users', userDoc.id);
        
        await updateDoc(userRef, {
          isRestricted: false,
          restrictionReason: null,
          restrictionUntil: null,
          noShowCount: 0
        });
        
        // Real-time listener will auto-update, no need to manually reload
        console.log('✅ Restriction removed for:', userEmail);
      }
    } catch (error) {
      console.error('Error removing restriction:', error);
    }
  };

  const addRestriction = async (userEmail: string) => {
    try {
      // Find user document by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', userEmail));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userRef = doc(db, 'users', userDoc.id);
        
        await updateDoc(userRef, {
          isRestricted: true,
          restrictionReason: 'Manually restricted by admin',
          restrictionUntil: null
        });
        
        // Real-time listener will auto-update, no need to manually reload
        console.log('✅ Restriction added for:', userEmail);
      }
    } catch (error) {
      console.error('Error adding restriction:', error);
    }
  };

  const resetNoShowCount = async (userEmail: string) => {
    try {
      // Find user document by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', userEmail));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userRef = doc(db, 'users', userDoc.id);
        
        await updateDoc(userRef, {
          noShowCount: 0
        });
        
        // Real-time listener will auto-update, no need to manually reload
        console.log('✅ No-show count reset for:', userEmail);
      }
    } catch (error) {
      console.error('Error resetting no-show count:', error);
    }
  };

  // Helper function to determine if user has reached daily limit
  const hasReachedDailyLimit = (user: UserStats) => {
    return (user.dailyAppointmentsCount || 0) >= 2;
  };

  // Helper function to get restriction reason display
  const getRestrictionReason = (user: UserStats) => {
    if (user.restrictionReason) {
      return user.restrictionReason;
    }
    if (hasReachedDailyLimit(user)) {
      return 'Daily appointment limit reached';
    }
    if (user.noShowCount >= 3) {
      return 'Too many no-shows';
    }
    return 'Manually restricted';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-2xl font-bold mb-6">User Management</h2>
      
      {/* MOBILE CARD LAYOUT - Hidden on Desktop */}
      <div className="block md:hidden space-y-4">
        {users.map(user => {
          const reachedDailyLimit = hasReachedDailyLimit(user);
          const showUnrestrictButton = user.isRestricted || reachedDailyLimit;
          
          return (
            <div 
              key={user.id} 
              className={`rounded-lg shadow-md p-4 ${
                user.isRestricted || reachedDailyLimit ? 'bg-red-50 border-2 border-red-200' : 'bg-white border border-gray-200'
              }`}
            >
              {/* Email & Status */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{user.email}</p>
                  {(user.isRestricted || reachedDailyLimit) && (
                    <p className="text-xs text-red-600 mt-1">
                      {getRestrictionReason(user)}
                    </p>
                  )}
                </div>
                <div className="ml-2 flex-shrink-0">
                  {user.isRestricted || reachedDailyLimit ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      <XCircle className="w-3 h-3" />
                      Restricted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-600 mb-1">Active</p>
                  <p className="text-lg font-semibold text-gray-900">{user.activeAppointments}</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-600 mb-1">Total</p>
                  <p className="text-lg font-semibold text-gray-900">{user.totalBookings}</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-600 mb-1">No-Shows</p>
                  <p className={`text-lg font-semibold ${user.noShowCount >= 3 ? 'text-red-600' : 'text-gray-900'}`}>
                    {user.noShowCount}
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-600 mb-1">Today</p>
                  <p className={`text-lg font-semibold ${reachedDailyLimit ? 'text-red-600' : 'text-gray-900'}`}>
                    {user.dailyAppointmentsCount || 0}/2
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {showUnrestrictButton ? (
                  <button
                    onClick={() => removeRestriction(user.email)}
                    className="flex-1 min-w-[120px] px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Unrestrict
                  </button>
                ) : (
                  <button
                    onClick={() => addRestriction(user.email)}
                    className="flex-1 min-w-[120px] px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <Ban className="w-4 h-4" />
                    Restrict
                  </button>
                )}
                
                {user.noShowCount > 0 && (
                  <button
                    onClick={() => resetNoShowCount(user.email)}
                    className="flex-1 min-w-[120px] px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Count
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {users.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            No users found
          </div>
        )}
      </div>

      {/* DESKTOP TABLE LAYOUT - Hidden on Mobile */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg shadow-md">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-3 text-left">Email</th>
              <th className="border p-3 text-center">Active</th>
              <th className="border p-3 text-center">Total</th>
              <th className="border p-3 text-center">No-Shows</th>
              <th className="border p-3 text-center">Today</th>
              <th className="border p-3 text-center">Cancelled</th>
              <th className="border p-3 text-center">Status</th>
              <th className="border p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const reachedDailyLimit = hasReachedDailyLimit(user);
              const showUnrestrictButton = user.isRestricted || reachedDailyLimit;
              
              return (
                <tr key={user.id} className={user.isRestricted || reachedDailyLimit ? 'bg-red-50' : ''}>
                  <td className="border p-3">
                    <div>
                      <div>{user.email}</div>
                      {(user.isRestricted || reachedDailyLimit) && (
                        <div className="text-xs text-red-600 mt-1">
                          {getRestrictionReason(user)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border p-3 text-center">{user.activeAppointments}</td>
                  <td className="border p-3 text-center">{user.totalBookings}</td>
                  <td className="border p-3 text-center">
                    <span className={user.noShowCount >= 3 ? 'text-red-600 font-bold' : ''}>
                      {user.noShowCount}
                    </span>
                  </td>
                  <td className="border p-3 text-center">
                    <span className={reachedDailyLimit ? 'text-red-600 font-bold' : ''}>
                      {user.dailyAppointmentsCount || 0}/2
                    </span>
                  </td>
                  <td className="border p-3 text-center">{user.cancelledBookings}</td>
                  <td className="border p-3 text-center">
                    {user.isRestricted || reachedDailyLimit ? (
                      <span className="flex items-center justify-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" />
                        Restricted
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="border p-3 text-center">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {showUnrestrictButton ? (
                        <button
                          onClick={() => removeRestriction(user.email)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
                          title="Remove Restriction"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Unrestrict
                        </button>
                      ) : (
                        <button
                          onClick={() => addRestriction(user.email)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm flex items-center gap-1"
                          title="Add Restriction"
                        >
                          <Ban className="w-3 h-3" />
                          Restrict
                        </button>
                      )}
                      
                      {user.noShowCount > 0 && (
                        <button
                          onClick={() => resetNoShowCount(user.email)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-1"
                          title="Reset No-Show Count"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="border p-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;