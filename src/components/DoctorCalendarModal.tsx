import { X, ChevronLeft, ChevronRight, TreePine, Snowflake, Gift, Star, Bell } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  photo: string;
  isActive: boolean;
  maxSlots: number;
  maxSlotsPerDate?: { [date: string]: number };
  availableSlots: { [date: string]: string[] };
  unavailableDates: { [date: string]: boolean };
  createdAt: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  status: string;
  doctor: string;
  timeSlot: string;
  source?: string;
}

interface DoctorCalendarModalProps {
  doctorName: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAppointments: () => void;
}

// Christmas theme context/hook
const useChristmasTheme = () => {
  const [isChristmasMode, setIsChristmasMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('christmasTheme') === 'true';
    }
    return false;
  });

  const toggleChristmasMode = () => {
    const newMode = !isChristmasMode;
    setIsChristmasMode(newMode);
    localStorage.setItem('christmasTheme', String(newMode));
  };

  return { isChristmasMode, toggleChristmasMode };
};

const DoctorCalendarModal = ({ doctorName, isOpen, onClose }: DoctorCalendarModalProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isChristmasMode, toggleChristmasMode } = useChristmasTheme();

  // Load doctor data initially
  const loadDoctor = useCallback(async (): Promise<Doctor | null> => {
    try {
      console.log('🔍 Loading doctor data for:', doctorName);
      
      const doctorsRef = collection(db, 'doctors');
      
      let doctorQuery = query(doctorsRef, where('name', '==', doctorName));
      let doctorSnapshot = await getDocs(doctorQuery);
      
      if (doctorSnapshot.empty && !doctorName.startsWith('Dr.')) {
        console.log('🔍 Trying with "Dr." prefix...');
        doctorQuery = query(doctorsRef, where('name', '==', `Dr. ${doctorName}`));
        doctorSnapshot = await getDocs(doctorQuery);
      }
      
      if (doctorSnapshot.empty && doctorName.startsWith('Dr.')) {
        console.log('🔍 Trying without "Dr." prefix...');
        const nameWithoutPrefix = doctorName.replace(/^Dr\.\s*/i, '');
        doctorQuery = query(doctorsRef, where('name', '==', nameWithoutPrefix));
        doctorSnapshot = await getDocs(doctorQuery);
      }

      if (!doctorSnapshot.empty) {
        const doctorDoc = doctorSnapshot.docs[0];
        const doctorData = {
          id: doctorDoc.id,
          ...doctorDoc.data()
        } as Doctor;
        
        console.log('✅ Doctor loaded:', doctorData);
        return doctorData;
      } else {
        console.log('❌ No doctor found with name:', doctorName);
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading doctor:', error);
      return null;
    }
  }, [doctorName]);

  // Helper function to deduplicate appointments by timeSlot + appointmentDate
  const deduplicateAppointments = (appointmentsList: Appointment[]): Appointment[] => {
    const uniqueMap = new Map<string, Appointment>();
    
    appointmentsList.forEach(apt => {
      const key = `${apt.doctor}_${apt.appointmentDate}_${apt.timeSlot}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, apt);
      } else {
        const existing = uniqueMap.get(key);
        if (existing?.source === 'staff' && apt.source === 'patient') {
          uniqueMap.set(key, apt);
        }
      }
    });
    
    const deduplicated = Array.from(uniqueMap.values());
    console.log(`🔄 Deduplicated: ${appointmentsList.length} -> ${deduplicated.length} appointments`);
    return deduplicated;
  };

  // Set up real-time listeners for appointments
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    
    let unsubscribeDoctor: Unsubscribe | null = null;
    let unsubscribePatientAppointments: Unsubscribe | null = null;
    let unsubscribeStaffAppointments: Unsubscribe | null = null;
    let currentDoctorName: string | null = null;
    
    let patientAppointmentsCache: Appointment[] = [];
    let staffAppointmentsCache: Appointment[] = [];

    const setupListeners = async () => {
      const doctorData = await loadDoctor();
      
      if (!doctorData) {
        setDoctor(null);
        setAppointments([]);
        setIsLoading(false);
        return;
      }

      setDoctor(doctorData);
      currentDoctorName = doctorData.name;

      const doctorsRef = collection(db, 'doctors');
      const doctorQuery = query(doctorsRef, where('name', '==', currentDoctorName));
      
      unsubscribeDoctor = onSnapshot(doctorQuery, (snapshot) => {
        if (!snapshot.empty) {
          const updatedDoctor = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
          } as Doctor;
          console.log('🔄 Doctor data updated in real-time:', updatedDoctor.name);
          setDoctor(updatedDoctor);
        }
      }, (error) => {
        console.error('❌ Error listening to doctor changes:', error);
      });

      const patientAppointmentsRef = collection(db, 'patient_appointments');
      const patientQuery = query(
        patientAppointmentsRef,
        where('doctor', '==', currentDoctorName)
      );

      unsubscribePatientAppointments = onSnapshot(patientQuery, (snapshot) => {
        patientAppointmentsCache = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          source: 'patient'
        })) as Appointment[];
        
        console.log('🔄 Patient appointments updated:', patientAppointmentsCache.length);
        
        const combined = [...patientAppointmentsCache, ...staffAppointmentsCache];
        const deduplicated = deduplicateAppointments(combined);
        setAppointments(deduplicated);
      }, (error) => {
        console.error('❌ Error listening to patient appointments:', error);
      });

      const staffAppointmentsRef = collection(db, 'staff_appointments');
      const staffQuery = query(
        staffAppointmentsRef,
        where('doctor', '==', currentDoctorName)
      );

      unsubscribeStaffAppointments = onSnapshot(staffQuery, (snapshot) => {
        staffAppointmentsCache = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          source: 'staff'
        })) as Appointment[];
        
        console.log('🔄 Staff appointments updated:', staffAppointmentsCache.length);
        
        const combined = [...patientAppointmentsCache, ...staffAppointmentsCache];
        const deduplicated = deduplicateAppointments(combined);
        setAppointments(deduplicated);
      }, (error) => {
        console.error('❌ Error listening to staff appointments:', error);
      });

      setIsLoading(false);
    };

    setupListeners();

    return () => {
      console.log('🧹 Cleaning up Firebase listeners...');
      if (unsubscribeDoctor) {
        unsubscribeDoctor();
      }
      if (unsubscribePatientAppointments) {
        unsubscribePatientAppointments();
      }
      if (unsubscribeStaffAppointments) {
        unsubscribeStaffAppointments();
      }
    };
  }, [isOpen, doctorName, loadDoctor]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const days: string[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateString = `${year}-${month}-${dayStr}`;
      days.push(dateString);
    }

    return days;
  };

  // Count booked slots (deduplicated)
  const getBookedSlotsForDate = (date: string): number => {
    const booked = appointments.filter(
      apt => apt.appointmentDate === date && 
             apt.status !== 'cancelled' &&
             apt.status !== 'completed' &&
             apt.status !== 'no-show'
    ).length;
    console.log(`📅 ${date}: Booked slots = ${booked}`);
    return booked;
  };

  // Calculate max available slots correctly
  const getMaxSlotsForDate = (date: string): number => {
    if (!doctor) {
      console.log(`❌ ${date}: No doctor data`);
      return 0;
    }

    const unavailableDates = doctor.unavailableDates || {};
    if (unavailableDates[date]) {
      console.log(`   ⛔ Date is marked as unavailable`);
      return 0;
    }

    const maxSlotsPerDate = doctor.maxSlotsPerDate || {};
    const dateSpecificSlots = maxSlotsPerDate[date];
    const globalSlots = doctor.maxSlots || 0;
    
    const maxSlots = dateSpecificSlots !== undefined ? dateSpecificSlots : globalSlots;

    const unavailableTimeSlots = doctor.availableSlots?.[date] || [];
    const availableSlots = Math.max(0, maxSlots - unavailableTimeSlots.length);

    return availableSlots;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center p-4 z-50 ${
      isChristmasMode ? 'christmas-theme' : ''
    }`}>
      {/* Background Snowflakes Overlay */}
      {isChristmasMode && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-40">
          {[...Array(80)].map((_, i) => (
            <Snowflake
              key={`bg-snowflake-${i}`}
              className="absolute text-white/70 animate-float-slow"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${-10 + Math.random() * 20}%`,
                animationDelay: `${Math.random() * 15}s`,
                animationDuration: `${15 + Math.random() * 25}s`,
                filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))',
              }}
              size={15 + Math.random() * 25}
            />
          ))}
        </div>
      )}

      <div className={`relative rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden ${
        isChristmasMode 
          ? 'bg-gradient-to-br from-red-50/98 to-green-50/98 backdrop-blur-xl border-2 border-green-300/60 shadow-green-200/30 animate-glow' 
          : 'bg-white/95 backdrop-blur-lg border border-white/20'
      }`}>
        
        {/* Scrollable Content Wrapper */}
        <div className="overflow-y-auto max-h-[90vh]">

        {/* Decorative Christmas Icons - Background Layer */}
        {isChristmasMode && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl z-[1]">
            <Gift className="absolute top-8 left-8 text-green-500/25" size={36} />
            <Star className="absolute top-12 right-12 text-yellow-400/25" size={32} />
            <Bell className="absolute bottom-32 left-20 text-red-500/25" size={34} />
            <Gift className="absolute bottom-32 right-24 text-red-500/25" size={40} />
            <Star className="absolute top-40 left-32 text-yellow-400/25" size={28} />
            {/* Additional Christmas Decorations */}
            <span className="absolute top-16 left-20 text-2xl text-green-500/30">🎄</span>
            <span className="absolute bottom-40 right-16 text-3xl text-red-500/25">🎅</span>
            <span className="absolute top-24 right-32 text-xl text-yellow-400/30">🌟</span>
            <span className="absolute bottom-20 left-32 text-2xl text-blue-400/25">⛄</span>
          </div>
        )}

        {/* Header */}
        <div className={`flex items-start justify-between p-6 rounded-t-xl relative z-[20] ${
          isChristmasMode
            ? 'bg-gradient-to-r from-green-600/90 to-red-600/90 backdrop-blur-sm border-b border-green-400/60'
            : 'bg-white/80 backdrop-blur-sm border-b border-gray-200'
        }`}>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {isChristmasMode && <Star className="text-yellow-300 flex-shrink-0" size={24} />}
              <h1 className={`text-3xl font-bold ${
                isChristmasMode ? 'text-white christmas-text-glow' : 'text-gray-900'
              }`}>
                Doctor Availability Calendar
              </h1>
              {isChristmasMode && <Star className="text-yellow-300 flex-shrink-0" size={24} />}
            </div>
            <p className={`mt-2 ${isChristmasMode ? 'text-green-100' : 'text-gray-600'}`}>
              View your scheduled appointments and available slots
            </p>
            {doctor && (
              <p className={`text-sm mt-1 ${
                isChristmasMode ? 'text-yellow-200' : 'text-blue-600'
              }`}>
                📡 Real-time updates enabled for {doctor.name}
              </p>
            )}
          </div>
          
          {/* Christmas Theme Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleChristmasMode}
              className={`p-2 rounded-lg transition-all duration-300 ${
                isChristmasMode
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg transform hover:scale-110 animate-glow'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              aria-label="Toggle Christmas theme"
            >
              <TreePine className="w-6 h-6" />
            </button>
            
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition ${
                isChristmasMode
                  ? 'hover:bg-red-500/20 text-white'
                  : 'hover:bg-gray-100 text-gray-600'
              } ml-4 flex-shrink-0 md:relative absolute top-4 right-4 md:top-auto md:right-auto`}
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-transparent relative z-[20]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${
                  isChristmasMode ? 'border-green-500' : 'border-blue-600'
                }`}></div>
                <p className={isChristmasMode ? 'text-green-800' : 'text-gray-600'}>
                  Loading calendar...
                </p>
              </div>
            </div>
          ) : !doctor ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className={isChristmasMode ? 'text-red-700 text-xl' : 'text-gray-600 text-xl'}>
                  Doctor not found
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Stats - TOP */}
              <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-lg p-4 text-center border relative overflow-hidden ${
                  isChristmasMode
                    ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300/80 shadow-lg shadow-red-200/30 animate-glow'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  {isChristmasMode && (
                    <span className="absolute top-2 right-2 text-red-400/30 text-lg">🎁</span>
                  )}
                  <p className={`text-2xl font-bold relative z-10 ${
                    isChristmasMode ? 'text-red-700' : 'text-blue-700'
                  }`}>
                    {doctor.maxSlots || 0}
                  </p>
                  <p className={`text-sm relative z-10 ${
                    isChristmasMode ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    Default Daily Slots
                  </p>
                </div>
                <div className={`rounded-lg p-4 text-center border relative overflow-hidden ${
                  isChristmasMode
                    ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300/80 shadow-lg shadow-green-200/30 animate-glow'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  {isChristmasMode && (
                    <span className="absolute top-2 right-2 text-green-400/30 text-lg">⛄</span>
                  )}
                  <p className={`text-2xl font-bold relative z-10 ${
                    isChristmasMode ? 'text-green-700' : 'text-orange-700'
                  }`}>
                    {appointments.filter(apt => 
                      apt.status === 'pending' || apt.status === 'confirmed' || apt.status === 'scheduled'
                    ).length}
                  </p>
                  <p className={`text-sm relative z-10 ${
                    isChristmasMode ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    Active Appointments
                  </p>
                </div>
                <div className={`rounded-lg p-4 text-center border relative overflow-hidden ${
                  isChristmasMode
                    ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300/80 shadow-lg shadow-yellow-200/30 animate-glow'
                    : 'bg-gray-100 border-gray-300'
                }`}>
                  {isChristmasMode && (
                    <span className="absolute top-2 right-2 text-yellow-400/30 text-lg">🎄</span>
                  )}
                  <p className={`text-2xl font-bold relative z-10 ${
                    isChristmasMode ? 'text-yellow-700' : 'text-gray-700'
                  }`}>
                    {Object.keys(doctor.unavailableDates || {}).filter(date => doctor.unavailableDates?.[date]).length}
                  </p>
                  <p className={`text-sm relative z-10 ${
                    isChristmasMode ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    Blocked Dates
                  </p>
                </div>
                <div className={`rounded-lg p-4 text-center border relative overflow-hidden ${
                  isChristmasMode
                    ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300/80 shadow-lg shadow-blue-200/30 animate-glow'
                    : 'bg-green-50 border-green-200'
                }`}>
                  {isChristmasMode && (
                    <span className="absolute top-2 right-2 text-blue-400/30 text-lg">🌟</span>
                  )}
                  <p className={`text-2xl font-bold relative z-10 ${
                    isChristmasMode ? 'text-blue-700' : 'text-green-700'
                  }`}>
                    {appointments.filter(apt => apt.status === 'completed').length}
                  </p>
                  <p className={`text-sm relative z-10 ${
                    isChristmasMode ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    Completed
                  </p>
                </div>
              </div>

              {/* Calendar View */}
              <div className={`rounded-lg p-6 border backdrop-blur-sm relative overflow-hidden ${
                isChristmasMode
                  ? 'bg-white/95 border-green-300/80 shadow-2xl shadow-green-200/20 christmas-border'
                  : 'bg-white/80 border-gray-200'
              }`}>
                
                {/* Calendar Header with Navigation */}
                <div className="flex items-center justify-center mb-6">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className={`p-3 rounded-lg transition-all duration-300 border ${
                        isChristmasMode
                          ? 'hover:bg-green-100 text-green-700 border-green-400 hover:shadow-lg hover:scale-105'
                          : 'hover:bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                      aria-label="Previous month"
                    >
                      {isChristmasMode ? (
                        <span className="text-xl">🎅</span>
                      ) : (
                        <ChevronLeft className="w-5 h-5" />
                      )}
                    </button>
                    
                    <h2 className={`text-xl font-semibold text-center min-w-[200px] ${
                      isChristmasMode ? 'text-green-800 christmas-text-glow' : 'text-gray-900'
                    }`}>
                      {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h2>
                    
                    <button
                      onClick={() => navigateMonth('next')}
                      className={`p-3 rounded-lg transition-all duration-300 border ${
                        isChristmasMode
                          ? 'hover:bg-green-100 text-green-700 border-green-400 hover:shadow-lg hover:scale-105'
                          : 'hover:bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                      aria-label="Next month"
                    >
                      {isChristmasMode ? (
                        <span className="text-xl">🦌</span>
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                    <div key={day} className={`p-3 text-center text-sm font-medium rounded-lg backdrop-blur-sm ${
                      isChristmasMode
                        ? 'bg-gradient-to-b from-green-200 to-green-100 text-green-900 border border-green-300/50'
                        : 'bg-gray-100/80 text-gray-700'
                    }`}>
                      {isChristmasMode && (
                        <span className="mr-1 text-xs">🎄</span>
                      )}
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                    <div key={`empty-${index}`} className="min-h-[80px]" />
                  ))}
                  
                  {generateCalendarDays().map((date) => {
                    const bookedSlots = getBookedSlotsForDate(date);
                    const totalSlots = getMaxSlotsForDate(date);
                    const remainingSlots = Math.max(0, totalSlots - bookedSlots);
                    const isToday = date === new Date().toISOString().split('T')[0];
                    const isPast = new Date(date) < new Date(new Date().toISOString().split('T')[0]);

                    // Christmas emojis for different date statuses
                    const getChristmasEmoji = () => {
                      if (isPast) return '❄️';
                      if (isToday) return '🎅';
                      if (totalSlots === 0) return '🎄';
                      if (remainingSlots === 0) return '🎁';
                      if (remainingSlots > 0 && bookedSlots > 0) return '🌟';
                      return '🦌';
                    };

                    return (
                      <div
                        key={date}
                        className={`p-2 rounded-lg border min-h-[80px] flex flex-col backdrop-blur-sm relative overflow-hidden ${
                          isToday
                            ? isChristmasMode
                              ? 'border-2 border-red-500 bg-gradient-to-br from-red-100 to-red-50 shadow-lg shadow-red-200/50'
                              : 'border-2 border-blue-500 bg-blue-100/80'
                            : isChristmasMode
                            ? 'border-green-200/80 bg-white/95 hover:bg-green-50/80 transition-colors duration-200'
                            : 'border-gray-200 bg-white/90'
                        } ${isPast ? 'opacity-60' : ''}`}
                      >
                        {/* Christmas emoji decoration for dates */}
                        {isChristmasMode && (
                          <span className="absolute top-1 right-1 text-xs opacity-60">
                            {getChristmasEmoji()}
                          </span>
                        )}
                        
                        <div className="flex flex-col items-center justify-between flex-1">
                          <div className="flex items-center gap-1.5">
                            {isChristmasMode && (
                              <Gift 
                                className={`${
                                  isPast
                                    ? 'text-green-600'
                                    : isToday 
                                    ? 'text-red-600' 
                                    : totalSlots === 0
                                    ? 'text-gray-400'
                                    : remainingSlots === 0
                                    ? 'text-red-500'
                                    : remainingSlots > 0 && bookedSlots > 0
                                    ? 'text-yellow-500'
                                    : 'text-green-600'
                                }`} 
                                size={12} 
                              />
                            )}
                            <span className={`text-sm font-medium ${
                              isToday 
                                ? isChristmasMode 
                                  ? 'text-red-700 font-bold' 
                                  : 'text-blue-700 font-bold'
                                : isChristmasMode
                                ? 'text-green-900'
                                : 'text-gray-700'
                            }`}>
                              {new Date(date + 'T00:00:00').getDate()}
                            </span>
                          </div>
                          {!isPast && (
                            <>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm border ${
                                totalSlots === 0
                                  ? isChristmasMode
                                    ? 'bg-gray-300/80 text-gray-600 border-gray-400'
                                    : 'bg-gray-200/80 text-gray-600'
                                  : bookedSlots >= totalSlots
                                  ? isChristmasMode
                                    ? 'bg-red-200/80 text-red-900 border-red-300'
                                    : 'bg-red-100/80 text-red-700'
                                  : bookedSlots > 0
                                  ? isChristmasMode
                                    ? 'bg-green-200/80 text-green-900 border-green-300'
                                    : 'bg-green-100/80 text-green-700'
                                  : isChristmasMode
                                  ? 'bg-blue-200/80 text-blue-900 border-blue-300'
                                  : 'bg-blue-100/80 text-blue-700'
                              }`}>
                                {totalSlots === 0 ? 'No slots' : `${bookedSlots}/${totalSlots}`}
                              </span>
                              {totalSlots > 0 && remainingSlots > 0 && (
                                <span className={`text-xs mt-1 ${
                                  isChristmasMode ? 'text-green-700 font-medium' : 'text-gray-500'
                                }`}>
                                  {remainingSlots} left
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        </div> {/* Close scrollable wrapper */}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
        }
        
        @keyframes float-slow {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        
        @keyframes glow {
          0%, 100% { 
            box-shadow: 0 0 5px rgba(34, 197, 94, 0.3);
          }
          50% { 
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.4), 0 0 30px rgba(239, 68, 68, 0.3);
          }
        }
        
        .animate-float {
          animation: float linear infinite;
        }
        
        .animate-float-slow {
          animation: float-slow linear infinite;
        }
        
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
        
        .christmas-theme {
          background: transparent !important;
        }
        
        .christmas-border {
          border: 2px solid;
          border-image: linear-gradient(45deg, #dc2626, #16a34a, #dc2626) 1;
        }
        
        .christmas-text-glow {
          text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
        }
      `}</style>
    </div>
  );
};

export default DoctorCalendarModal;