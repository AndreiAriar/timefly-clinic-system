// src/components/admin/UserManagement.tsx
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, where, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CheckCircle, XCircle, Ban, RefreshCw, User, Stethoscope, Users, Search, Filter } from 'lucide-react';

interface Appointment {
  id: string;
  email: string;
  status: string;
  appointmentDate: string;
}

interface UserStats {
  id: string;
  email: string;
  type: 'patient' | 'staff' | 'doctor';
  activeAppointments: number;
  totalBookings: number;
  noShowCount: number;
  cancelledBookings: number;
  isRestricted: boolean;
  restrictionReason?: string;
  restrictionUntil?: string;
  dailyAppointmentsCount?: number;
}

type UserType = 'patient' | 'staff' | 'doctor';
type TypeFilter = 'all' | UserType;

const UserManagement = () => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

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
        
        // PROPERLY FETCH USER ROLE FROM FIRESTORE
        const userType = userData.role || userData.type || 'patient';
        
        // Validate and ensure type is one of the allowed values
        const validatedType: UserType = 
          userType === 'staff' || userType === 'doctor' ? userType : 'patient';

        // Skip if we already processed this email
        if (uniqueUsersMap.has(userEmail)) {
          console.log(`⚠️ Duplicate email found: ${userEmail}, skipping document ${userDoc.id}`);
          return;
        }

        // For staff and doctors, skip appointment calculations as they don't book appointments
        if (validatedType === 'staff' || validatedType === 'doctor') {
          uniqueUsersMap.set(userEmail, {
            id: userDoc.id,
            email: userEmail,
            type: validatedType,
            activeAppointments: 0,
            totalBookings: 0,
            noShowCount: 0,
            cancelledBookings: 0,
            dailyAppointmentsCount: 0,
            isRestricted: userData.isRestricted || false,
            restrictionReason: userData.restrictionReason,
            restrictionUntil: userData.restrictionUntil
          });
          return;
        }

        // For patients only: Filter appointments for this user - ONLY COUNT ACTIVE ONES
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

        // Check if user should be automatically restricted based on daily limit (patients only)
        const hasReachedDailyLimit = dailyAppointmentsCount >= 2;
        const isAutoRestricted = hasReachedDailyLimit || noShowCount >= 3;
        
        uniqueUsersMap.set(userEmail, {
          id: userDoc.id,
          email: userEmail,
          type: validatedType,
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
      
      // Sort by type first, then by no-show count (highest first) for patients
      usersData.sort((a, b) => {
        // Sort by type: staff -> doctor -> patient
        const typeOrder = { staff: 0, doctor: 1, patient: 2 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }
        // For patients, sort by no-show count
        if (a.type === 'patient' && b.type === 'patient') {
          return b.noShowCount - a.noShowCount;
        }
        return 0;
      });
      
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

  // Filter users based on type and search query
  const filteredUsers = users.filter(user => {
    const matchesType = typeFilter === 'all' || user.type === typeFilter;
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

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

  // Helper function to determine if user has reached daily limit (patients only)
  const hasReachedDailyLimit = (user: UserStats) => {
    return user.type === 'patient' && (user.dailyAppointmentsCount || 0) >= 2;
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

  // Helper function to get user type badge
  const getUserTypeBadge = (type: UserType) => {
    const styles = {
      patient: 'bg-blue-100 text-blue-800 border-blue-200',
      staff: 'bg-green-100 text-green-800 border-green-200',
      doctor: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    
    const icons = {
      patient: <Users className="w-3 h-3" />,
      staff: <User className="w-3 h-3" />,
      doctor: <Stethoscope className="w-3 h-3" />
    };
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[type]}`}>
        {icons[type]}
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  // Helper function to show/hide actions based on user type
  const shouldShowActions = (user: UserStats) => {
    // Only show restriction actions for patients
    return user.type === 'patient';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">User Management</h2>
          <p className="text-gray-600">Manage user accounts and access permissions</p>
        </div>
        
        {/* Search and Filter Controls */}
        <div className="mb-8 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search users by email or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
              />
            </div>
            
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm"
              >
                <Filter className="h-5 w-5 text-gray-600" />
                <span className="text-gray-700">
                  {typeFilter === 'all' ? 'All Users' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
                </span>
              </button>
              
              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setTypeFilter('all');
                        setShowFilterDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        typeFilter === 'all' 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      All Users
                    </button>
                    <button
                      onClick={() => {
                        setTypeFilter('patient');
                        setShowFilterDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        typeFilter === 'patient' 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Patients
                    </button>
                    <button
                      onClick={() => {
                        setTypeFilter('staff');
                        setShowFilterDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        typeFilter === 'staff' 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Staff
                    </button>
                    <button
                      onClick={() => {
                        setTypeFilter('doctor');
                        setShowFilterDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        typeFilter === 'doctor' 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Doctors
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Active Filters Display */}
          {(searchQuery || typeFilter !== 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Search: "{searchQuery}"
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-1 hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {typeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Type: {typeFilter}
                  <button
                    onClick={() => setTypeFilter('all')}
                    className="ml-1 hover:text-green-600"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Results Count */}
        <div className="mb-4">
          <p className="text-gray-600">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
        
        {/* MOBILE CARD LAYOUT - Hidden on Desktop */}
        <div className="block md:hidden space-y-4">
          {filteredUsers.map(user => {
            const reachedDailyLimit = hasReachedDailyLimit(user);
            const showUnrestrictButton = user.isRestricted || reachedDailyLimit;
            const showActions = shouldShowActions(user);
            
            return (
              <div 
                key={user.id} 
                className={`rounded-xl shadow-lg p-6 transition-all duration-200 ${
                  (user.isRestricted || reachedDailyLimit) && showActions 
                    ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200' 
                    : 'bg-white border border-gray-200 hover:shadow-xl'
                }`}
              >
                {/* Email, Type & Status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-gray-900 truncate text-lg">{user.email}</p>
                      {getUserTypeBadge(user.type)}
                    </div>
                    {(user.isRestricted || reachedDailyLimit) && showActions && (
                      <p className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-lg">
                        {getRestrictionReason(user)}
                      </p>
                    )}
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    {(user.isRestricted || reachedDailyLimit) && showActions ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        <XCircle className="w-4 h-4" />
                        Restricted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats Grid - Only show for patients */}
                {user.type === 'patient' && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-600 mb-1 font-medium">Active</p>
                      <p className="text-xl font-bold text-gray-900">{user.activeAppointments}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-600 mb-1 font-medium">Total</p>
                      <p className="text-xl font-bold text-gray-900">{user.totalBookings}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-600 mb-1 font-medium">No-Shows</p>
                      <p className={`text-xl font-bold ${user.noShowCount >= 3 ? 'text-red-600' : 'text-gray-900'}`}>
                        {user.noShowCount}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-600 mb-1 font-medium">Today</p>
                      <p className={`text-xl font-bold ${reachedDailyLimit ? 'text-red-600' : 'text-gray-900'}`}>
                        {user.dailyAppointmentsCount || 0}/2
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions - Only show for patients */}
                {showActions && (
                  <div className="flex flex-wrap gap-3">
                    {showUnrestrictButton ? (
                      <button
                        onClick={() => removeRestriction(user.email)}
                        className="flex-1 min-w-[140px] px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Unrestrict
                      </button>
                    ) : (
                      <button
                        onClick={() => addRestriction(user.email)}
                        className="flex-1 min-w-[140px] px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        <Ban className="w-4 h-4" />
                        Restrict
                      </button>
                    )}
                    
                    {user.noShowCount > 0 && (
                      <button
                        onClick={() => resetNoShowCount(user.email)}
                        className="flex-1 min-w-[140px] px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reset Count
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {filteredUsers.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500 border border-gray-200">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {/* DESKTOP TABLE LAYOUT - Hidden on Mobile */}
        <div className="hidden md:block overflow-hidden rounded-2xl shadow-lg bg-white border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="p-4 text-left font-semibold text-gray-700">Email</th>
                <th className="p-4 text-center font-semibold text-gray-700">Type</th>
                <th className="p-4 text-center font-semibold text-gray-700">Active</th>
                <th className="p-4 text-center font-semibold text-gray-700">Total</th>
                <th className="p-4 text-center font-semibold text-gray-700">No-Shows</th>
                <th className="p-4 text-center font-semibold text-gray-700">Today</th>
                <th className="p-4 text-center font-semibold text-gray-700">Cancelled</th>
                <th className="p-4 text-center font-semibold text-gray-700">Status</th>
                <th className="p-4 text-center font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const reachedDailyLimit = hasReachedDailyLimit(user);
                const showUnrestrictButton = user.isRestricted || reachedDailyLimit;
                const showActions = shouldShowActions(user);
                
                return (
                  <tr 
                    key={user.id} 
                    className={`transition-all duration-200 ${
                      (user.isRestricted || reachedDailyLimit) && showActions 
                        ? 'bg-gradient-to-r from-red-50 to-red-100' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 border-b border-gray-100">
                      <div>
                        <div className="font-medium text-gray-900">{user.email}</div>
                        {(user.isRestricted || reachedDailyLimit) && showActions && (
                          <div className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">
                            {getRestrictionReason(user)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 border-b border-gray-100 text-center">
                      {getUserTypeBadge(user.type)}
                    </td>
                    <td className="p-4 border-b border-gray-100 text-center">
                      {user.type === 'patient' ? (
                        <span className="font-semibold text-gray-900">{user.activeAppointments}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 border-b border-gray-100 text-center">
                      {user.type === 'patient' ? (
                        <span className="font-semibold text-gray-900">{user.totalBookings}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 border-b border-gray-100 text-center">
                      {user.type === 'patient' ? (
                        <span className={`font-semibold ${user.noShowCount >= 3 ? 'text-red-600' : 'text-gray-900'}`}>
                          {user.noShowCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 border-b border-gray-100 text-center">
                      {user.type === 'patient' ? (
                        <span className={`font-semibold ${reachedDailyLimit ? 'text-red-600' : 'text-gray-900'}`}>
                          {user.dailyAppointmentsCount || 0}/2
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 border-b border-gray-100 text-center">
                      {user.type === 'patient' ? (
                        <span className="font-semibold text-gray-900">{user.cancelledBookings}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 border-b border-gray-100 text-center">
                      {(user.isRestricted || reachedDailyLimit) && showActions ? (
                        <span className="flex items-center justify-center gap-2 text-red-600 font-medium">
                          <XCircle className="w-4 h-4" />
                          Restricted
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2 text-green-600 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-4 border-b border-gray-100 text-center">
                      {showActions ? (
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {showUnrestrictButton ? (
                            <button
                              onClick={() => removeRestriction(user.email)}
                              className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 text-sm flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                              title="Remove Restriction"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Unrestrict
                            </button>
                          ) : (
                            <button
                              onClick={() => addRestriction(user.email)}
                              className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 text-sm flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                              title="Add Restriction"
                            >
                              <Ban className="w-3 h-3" />
                              Restrict
                            </button>
                          )}
                          
                          {user.noShowCount > 0 && (
                            <button
                              onClick={() => resetNoShowCount(user.email)}
                              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                              title="Reset No-Show Count"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Reset
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm font-medium">No actions available</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium">No users found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;