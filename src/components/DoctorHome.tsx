import { Calendar, Clock, Users, Activity, Sun, Cloud, Moon, Snowflake } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase/config';
import DoctorCalendarModal from './DoctorCalendarModal';

interface DoctorHomeProps {
  doctorName: string;
  onNavigateToAppointments: () => void;
  onNavigateToQueue: () => void;
  isChristmasTheme?: boolean; // Add this prop
}

interface Appointment {
  id: string;
  appointmentDate: string;
  status: string;
  fullName?: string;
  age?: string;
  photo?: string;
  doctor?: string;
  gender?: string;
  medicalCondition?: string;
  phone?: string;
  priorityLevel?: string;
  timeSlot?: string;
  queueNumber?: number;
  createdAt?: string;
  cancelReason?: string;
  deletedByStaff?: boolean;
  deletedByPatient?: boolean;
}

interface Doctor {
  id: string;
  name: string;
  maxSlots: number;
  maxSlotsPerDate?: { [date: string]: number };
  availableSlots: { [date: string]: string[] };
  unavailableDates: { [date: string]: boolean };
}

// Snow Effect component for the entire home page content area
const SnowEffect = () => {
  const [snowflakes, setSnowflakes] = useState<Array<{
    id: number; 
    top: number; 
    left: number; 
    animationDuration: number; 
    size: number; 
    opacity: number;
    rotation: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    // Inject the CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes snowfall {
        0% {
          transform: translateY(-100px) translateX(0px) rotate(0deg);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) translateX(20px) rotate(360deg);
          opacity: 0;
        }
      }
      @keyframes float {
        0%, 100% {
          transform: translateY(0px) rotate(0deg);
        }
        50% {
          transform: translateY(-15px) rotate(180deg);
        }
      }
      @keyframes gentleFall {
        0% {
          transform: translateY(-50px) translateX(0px) rotate(0deg);
          opacity: 0;
        }
        10% {
          opacity: 0.7;
        }
        90% {
          opacity: 0.7;
        }
        100% {
          transform: translateY(80vh) translateX(15px) rotate(180deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    const generateSnowflakes = () => {
      const flakes = [];
      // Create snowflakes that cover the entire page content area
      for (let i = 0; i < 45; i++) {
        flakes.push({
          id: i,
          top: -50, // Start above the visible area
          left: Math.random() * 100,
          animationDuration: 10 + Math.random() * 20,
          size: 14 + Math.random() * 20, // Size for icons (14-34px)
          opacity: 0.4 + Math.random() * 0.6,
          rotation: Math.random() * 360,
          delay: Math.random() * 15,
        });
      }
      setSnowflakes(flakes);
    };

    generateSnowflakes();

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute text-blue-100"
          style={{
            top: `${flake.top}px`,
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animation: `gentleFall ${flake.animationDuration}s linear infinite`,
            animationDelay: `${flake.delay}s`,
            filter: 'blur(0.3px) drop-shadow(0 0 2px rgba(255, 255, 255, 0.5))',
          }}
        >
          <Snowflake 
            className="w-full h-full" 
            style={{ 
              transform: `rotate(${flake.rotation}deg)`,
            }}
          />
        </div>
      ))}
    </div>
  );
};

// Floating decorative snowflakes for the content area
const ContentSnowflakes = () => {
  const [flakes, setFlakes] = useState<Array<{
    id: number;
    top: number;
    left: number;
    size: number;
    opacity: number;
    duration: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    const generateContentFlakes = () => {
      const contentFlakes = [];
      // Create decorative snowflakes scattered throughout the content
      for (let i = 0; i < 25; i++) {
        contentFlakes.push({
          id: i,
          top: Math.random() * 100, // Cover entire content height
          left: Math.random() * 100, // Cover entire content width
          size: 8 + Math.random() * 16, // 8-24px
          opacity: 0.2 + Math.random() * 0.4,
          duration: 3 + Math.random() * 6,
          delay: Math.random() * 8,
        });
      }
      setFlakes(contentFlakes);
    };

    generateContentFlakes();
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {flakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute text-blue-50"
          style={{
            top: `${flake.top}%`,
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animation: `float ${flake.duration}s ease-in-out infinite`,
            animationDelay: `${flake.delay}s`,
          }}
        >
          <Snowflake className="w-full h-full" />
        </div>
      ))}
    </div>
  );
};

// Snowflake decorations for specific content areas
const StatsSnowflakes = () => {
  return (
    <>
      {/* Snowflakes around stats grid */}
      <div className="absolute -top-4 -left-4 text-blue-200 animate-pulse">
        <Snowflake className="w-6 h-6" />
      </div>
      <div className="absolute -top-4 -right-4 text-blue-200 animate-bounce">
        <Snowflake className="w-5 h-5" />
      </div>
      <div className="absolute -bottom-4 -left-4 text-blue-200 animate-pulse delay-1000">
        <Snowflake className="w-4 h-4" />
      </div>
      <div className="absolute -bottom-4 -right-4 text-blue-200 animate-bounce delay-500">
        <Snowflake className="w-5 h-5" />
      </div>
    </>
  );
};

const DoctorHome = ({ 
  doctorName, 
  onNavigateToAppointments, 
  isChristmasTheme = false // Default to false
}: DoctorHomeProps) => {
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingQueue: 0,
    completedToday: 0,
    availableSlots: 0
  });
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [greeting, setGreeting] = useState({ text: '', icon: <Sun className="h-8 w-8" /> });

  // Real-time greeting based on Philippine time
  useEffect(() => {
    const updateGreeting = () => {
      const phTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const hours = phTime.getHours();
      
      if (hours >= 5 && hours < 12) {
        setGreeting({ 
          text: 'Good morning', 
          icon: <Sun className="h-8 w-8 text-yellow-500 flex-shrink-0" />
        });
      } else if (hours >= 12 && hours < 18) {
        setGreeting({ 
          text: 'Good afternoon', 
          icon: (
            <div className="flex items-center flex-shrink-0">
              <Sun className="h-6 w-6 text-yellow-500" />
              <Cloud className="h-7 w-7 text-gray-400 -ml-2" />
            </div>
          )
        });
      } else {
        setGreeting({ 
          text: 'Good evening', 
          icon: <Moon className="h-8 w-8 text-blue-400 flex-shrink-0" />
        });
      }
    };

    // Update immediately
    updateGreeting();

    // Update every minute to handle day transitions
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log('🔥 Setting up real-time listeners for doctor stats...');

    // Get today's date in Philippine Time (UTC+8)
    const phTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const today = phTime.toISOString().split('T')[0];
    
    console.log('📅 Today\'s date (PH):', today);
    
    // Load doctor data first
    const loadDoctorData = async () => {
      try {
        const doctorsRef = collection(db, 'doctors');
        let doctorQuery = query(doctorsRef, where('name', '==', doctorName));
        let doctorSnapshot = await getDocs(doctorQuery);
        
        // Try with "Dr." prefix if not found
        if (doctorSnapshot.empty && !doctorName.startsWith('Dr.')) {
          doctorQuery = query(doctorsRef, where('name', '==', `Dr. ${doctorName}`));
          doctorSnapshot = await getDocs(doctorQuery);
        }
        
        // Try without "Dr." prefix if not found
        if (doctorSnapshot.empty && doctorName.startsWith('Dr.')) {
          const nameWithoutPrefix = doctorName.replace(/^Dr\.\s*/i, '');
          doctorQuery = query(doctorsRef, where('name', '==', nameWithoutPrefix));
          doctorSnapshot = await getDocs(doctorQuery);
        }

        let doctorData: Doctor | null = null;
        let actualDoctorName = doctorName;
        
        if (!doctorSnapshot.empty) {
          const doctorDoc = doctorSnapshot.docs[0];
          doctorData = {
            id: doctorDoc.id,
            ...doctorDoc.data()
          } as Doctor;
          actualDoctorName = doctorData.name;
          console.log('✅ Doctor data loaded:', actualDoctorName);
        }

        return { doctorData, actualDoctorName };
      } catch (error) {
        console.error('Error loading doctor data:', error);
        return { doctorData: null, actualDoctorName: doctorName };
      }
    };

    let unsubscribePatient: (() => void) | undefined;
    let unsubscribeStaff: (() => void) | undefined;

    const setupListeners = async () => {
      const { doctorData, actualDoctorName } = await loadDoctorData();
      
      // Setup real-time listeners for both appointment collections
      const patientAppointmentsRef = collection(db, 'patient_appointments');
      const staffAppointmentsRef = collection(db, 'staff_appointments');
      
      // Try multiple doctor name variations
      const patientQuery = query(
        patientAppointmentsRef,
        where('doctor', '==', actualDoctorName),
        where('appointmentDate', '==', today)
      );
      
      const staffQuery = query(
        staffAppointmentsRef,
        where('doctor', '==', actualDoctorName),
        where('appointmentDate', '==', today)
      );

      let allAppointments: Appointment[] = [];

      const updateStats = (appointments: Appointment[]) => {
        // Calculate stats
        const todayAppointments = appointments.filter(apt => 
          apt.status !== 'cancelled' && apt.status !== 'missed'
        ).length;
        
        const pendingQueue = appointments.filter(apt => 
          apt.status === 'pending' || 
          apt.status === 'scheduled' || 
          apt.status === 'confirmed'
        ).length;
        
        const completedToday = appointments.filter(apt => 
          apt.status === 'completed'
        ).length;

        // Calculate available slots
        let availableSlots = 0;
        
        if (doctorData) {
          const unavailableDates = doctorData.unavailableDates || {};
          
          if (unavailableDates[today]) {
            console.log('⛔ Doctor unavailable today');
            availableSlots = 0;
          } else {
            const maxSlotsPerDate = doctorData.maxSlotsPerDate || {};
            const dateSpecificSlots = maxSlotsPerDate[today];
            const maxSlots = dateSpecificSlots !== undefined ? dateSpecificSlots : (doctorData.maxSlots || 0);
            
            const unavailableTimeSlots = doctorData.availableSlots?.[today] || [];
            const totalAvailableSlots = Math.max(0, maxSlots - unavailableTimeSlots.length);
            const bookedSlots = appointments.filter(apt => 
              apt.status !== 'cancelled' && apt.status !== 'missed'
            ).length;
            availableSlots = Math.max(0, totalAvailableSlots - bookedSlots);
            
            console.log('📊 Slots calculation:', {
              maxSlots,
              unavailableTimeSlots: unavailableTimeSlots.length,
              totalAvailableSlots,
              bookedSlots,
              remaining: availableSlots
            });
          }
        } else {
          const bookedSlots = appointments.filter(apt => 
            apt.status !== 'cancelled' && apt.status !== 'missed'
          ).length;
          availableSlots = Math.max(0, 10 - bookedSlots);
          console.log('⚠️ Using fallback calculation');
        }

        setStats({
          todayAppointments,
          pendingQueue,
          completedToday,
          availableSlots
        });

        console.log('✅ Real-time doctor stats update:', {
          today: todayAppointments,
          pending: pendingQueue,
          completed: completedToday,
          available: availableSlots
        });
      };

          const handleAppointmentsUpdate = (snapshot: QuerySnapshot<DocumentData>, source: string) => {
        const newAppointments = snapshot.docs
          .map((doc) => ({
            id: `${source}_${doc.id}`,
            originalId: doc.id, // Keep original ID
            ...doc.data()
          } as Appointment & { originalId: string }))
          .filter((apt: Appointment) => !apt.deletedByStaff && !apt.deletedByPatient);

        console.log(`📊 ${source} appointments after filtering:`, newAppointments.length);

        // Update the combined appointments array by filtering out old appointments from this source
        allAppointments = allAppointments.filter(apt => !apt.id.startsWith(`${source}_`));
        allAppointments = [...allAppointments, ...newAppointments];

        // Deduplicate based on appointment details
        const uniqueAppointments = allAppointments.reduce((acc, current) => {
          const key = `${current.appointmentDate}_${current.timeSlot}_${current.fullName}_${current.doctor}`;
          
          if (!acc.has(key)) {
            acc.set(key, current);
          } else {
            // Prefer patient_appointments over staff_appointments
            const existing = acc.get(key);
            if (existing && current.id.startsWith('patient_')) {
              acc.set(key, current);
            }
          }
          
          return acc;
        }, new Map<string, Appointment>());

        allAppointments = Array.from(uniqueAppointments.values());

        console.log('📊 Combined Appointments (after deduplication):', allAppointments.length);
        updateStats(allAppointments);
      };
      // Subscribe to patient appointments
      unsubscribePatient = onSnapshot(
        patientQuery,
        (snapshot) => {
          console.log('📊 Patient appointments update received');
          handleAppointmentsUpdate(snapshot, 'patient');
        },
        (error) => {
          console.error('❌ Error in patient appointments listener:', error);
        }
      );

      // Subscribe to staff appointments
      unsubscribeStaff = onSnapshot(
        staffQuery,
        (snapshot) => {
          console.log('📊 Staff appointments update received');
          handleAppointmentsUpdate(snapshot, 'staff');
        },
        (error) => {
          console.error('❌ Error in staff appointments listener:', error);
        }
      );
    };

    setupListeners();

    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up doctor stats listeners');
      if (unsubscribePatient) unsubscribePatient();
      if (unsubscribeStaff) unsubscribeStaff();
    };
  }, [doctorName]);

  return (
    <>
      <div className={`min-h-screen ${isChristmasTheme ? 'bg-gradient-to-br from-red-50 to-green-50' : 'bg-gray-50'} relative overflow-hidden`}>
        {/* Christmas Theme Effects - Cover entire page content */}
        {isChristmasTheme && (
          <>
            <SnowEffect />
            <ContentSnowflakes />
          </>
        )}
        
        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
          {/* Welcome Section */}
          <div className="text-center mb-12 relative">
            {isChristmasTheme && (
              <div className="absolute -top-8 left-1/4 transform -translate-x-1/2">
                <Snowflake className="w-8 h-8 text-blue-200 animate-pulse" />
              </div>
            )}
            {isChristmasTheme && (
              <div className="absolute -top-4 right-1/4 transform translate-x-1/2">
                <Snowflake className="w-6 h-6 text-blue-300 animate-bounce delay-700" />
              </div>
            )}
            {isChristmasTheme && (
              <div className="absolute top-1/2 -left-8 transform -translate-y-1/2">
                <Snowflake className="w-5 h-5 text-blue-200 animate-spin" />
              </div>
            )}
            {isChristmasTheme && (
              <div className="absolute top-1/2 -right-8 transform -translate-y-1/2">
                <Snowflake className="w-7 h-7 text-blue-300 animate-pulse delay-1000" />
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
              {isChristmasTheme ? (
                <div className="flex items-center space-x-3">
                  <div className="text-red-500 flex-shrink-0 animate-pulse">
                    <Snowflake className="h-10 w-10" />
                  </div>
                  <div className="text-green-500 flex-shrink-0 animate-bounce">
                    <Snowflake className="h-8 w-8" />
                  </div>
                </div>
              ) : (
                greeting.icon
              )}
              <h1 className={`text-3xl sm:text-4xl font-bold ${isChristmasTheme ? 'text-green-700' : 'text-black'}`}>
                {isChristmasTheme ? '🎄 Merry Christmas! 🎄' : `${greeting.text},`}<br className="sm:hidden" /> {isChristmasTheme ? '' : 'Dr.'} {doctorName}{isChristmasTheme ? '' : '!'}
              </h1>
            </div>
            <p className={`text-lg sm:text-xl ${isChristmasTheme ? 'text-green-800' : 'text-black'} max-w-2xl mx-auto px-4`}>
              {isChristmasTheme 
                ? 'Wishing you joy and peace this holiday season! Manage your appointments with Christmas cheer. 🎅' 
                : 'Manage your appointments and patient queue efficiently with TimeFly\'s scheduling system.'}
            </p>
          </div>
          
          {/* Stats Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 relative ${isChristmasTheme ? 'transform transition-all duration-300' : ''}`}>
            {isChristmasTheme && <StatsSnowflakes />}
            
            {/* Today's Appointments */}
            <div className={`rounded-xl shadow-lg p-6 border-l-4 relative overflow-hidden ${isChristmasTheme ? 'bg-white border-red-500' : 'bg-white border-blue-500'}`}>
              {isChristmasTheme && (
                <div className="absolute -top-2 -right-2 text-red-200">
                  <Snowflake className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                  <p className={`text-3xl font-bold ${isChristmasTheme ? 'text-red-600' : 'text-gray-900'}`}>{stats.todayAppointments}</p>
                </div>
                <Calendar className={`h-8 w-8 ${isChristmasTheme ? 'text-red-500' : 'text-blue-500'}`} />
              </div>
            </div>

            {/* Pending Queue */}
            <div className={`rounded-xl shadow-lg p-6 border-l-4 relative overflow-hidden ${isChristmasTheme ? 'bg-white border-green-500' : 'bg-white border-yellow-500'}`}>
              {isChristmasTheme && (
                <div className="absolute -top-2 -right-2 text-green-200">
                  <Snowflake className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending in Queue</p>
                  <p className={`text-3xl font-bold ${isChristmasTheme ? 'text-green-600' : 'text-gray-900'}`}>{stats.pendingQueue}</p>
                </div>
                <Users className={`h-8 w-8 ${isChristmasTheme ? 'text-green-500' : 'text-yellow-500'}`} />
              </div>
            </div>

            {/* Completed Today */}
            <div className={`rounded-xl shadow-lg p-6 border-l-4 relative overflow-hidden ${isChristmasTheme ? 'bg-white border-red-500' : 'bg-white border-green-500'}`}>
              {isChristmasTheme && (
                <div className="absolute -top-2 -right-2 text-red-200">
                  <Snowflake className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Today</p>
                  <p className={`text-3xl font-bold ${isChristmasTheme ? 'text-red-600' : 'text-gray-900'}`}>{stats.completedToday}</p>
                </div>
                <Activity className={`h-8 w-8 ${isChristmasTheme ? 'text-red-500' : 'text-green-500'}`} />
              </div>
            </div>

            {/* Available Slots */}
            <div className={`rounded-xl shadow-lg p-6 border-l-4 relative overflow-hidden ${isChristmasTheme ? 'bg-white border-green-500' : 'bg-white border-purple-500'}`}>
              {isChristmasTheme && (
                <div className="absolute -top-2 -right-2 text-green-200">
                  <Snowflake className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Available Slots</p>
                  <p className={`text-3xl font-bold ${isChristmasTheme ? 'text-green-600' : 'text-gray-900'}`}>{stats.availableSlots}</p>
                </div>
                <Clock className={`h-8 w-8 ${isChristmasTheme ? 'text-green-500' : 'text-purple-500'}`} />
              </div>
            </div>
          </div>

          {/* Center Calendar Button */}
          <div className="flex justify-center relative">
            {isChristmasTheme && (
              <div className="absolute -top-6 left-1/3 transform -translate-x-1/2">
                <Snowflake className="w-7 h-7 text-blue-300 animate-pulse" />
              </div>
            )}
            {isChristmasTheme && (
              <div className="absolute -top-6 right-1/3 transform translate-x-1/2">
                <Snowflake className="w-6 h-6 text-blue-200 animate-bounce delay-500" />
              </div>
            )}
            {isChristmasTheme && (
              <div className="absolute -bottom-6 left-1/3 transform -translate-x-1/2">
                <Snowflake className="w-5 h-5 text-blue-300 animate-spin delay-1000" />
              </div>
            )}
            {isChristmasTheme && (
              <div className="absolute -bottom-6 right-1/3 transform translate-x-1/2">
                <Snowflake className="w-6 h-6 text-blue-200 animate-pulse delay-1500" />
              </div>
            )}
            
            <button
              onClick={() => setShowCalendarModal(true)}
              className={`px-8 sm:px-12 py-4 sm:py-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 shadow-lg flex items-center space-x-3 border relative ${
                isChristmasTheme 
                  ? 'bg-gradient-to-r from-red-600 to-green-600 text-white border-red-700 hover:from-red-700 hover:to-green-700' 
                  : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
              }`}
            >
              {isChristmasTheme && (
                <div className="absolute -top-3 -left-3">
                  <Snowflake className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {isChristmasTheme && (
                <div className="absolute -top-3 -right-3">
                  <Snowflake className="w-5 h-5 text-white animate-spin delay-1000" />
                </div>
              )}
              {isChristmasTheme && (
                <div className="absolute -bottom-3 -left-3">
                  <Snowflake className="w-4 h-4 text-white animate-pulse" />
                </div>
              )}
              {isChristmasTheme && (
                <div className="absolute -bottom-3 -right-3">
                  <Snowflake className="w-4 h-4 text-white animate-pulse delay-500" />
                </div>
              )}
              
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8" />
              <span>{isChristmasTheme ? '🎅 View Calendar' : 'View Calendar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Modal */}
      {showCalendarModal && (
        <DoctorCalendarModal
          doctorName={doctorName}
          isOpen={showCalendarModal}
          onClose={() => setShowCalendarModal(false)}
          onNavigateToAppointments={onNavigateToAppointments}
        />
      )}
    </>
  );
};

export default DoctorHome;