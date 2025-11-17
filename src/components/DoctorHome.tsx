import { Calendar, Clock, Users, Activity, Sun, Cloud, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs} from 'firebase/firestore';
import { db } from '../firebase/config';
import DoctorCalendarModal from './DoctorCalendarModal';

interface DoctorHomeProps {
  doctorName: string;
  onNavigateToAppointments: () => void;
  onNavigateToQueue: () => void;
}

interface Appointment {
  id: string;
  status: string;
  appointmentDate: string;
}

interface Doctor {
  id: string;
  name: string;
  maxSlots: number;
  maxSlotsPerDate?: { [date: string]: number };
  availableSlots: { [date: string]: string[] };
  unavailableDates: { [date: string]: boolean };
}

const DoctorHome = ({ doctorName, onNavigateToAppointments, onNavigateToQueue }: DoctorHomeProps) => {
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingQueue: 0,
    completedToday: 0,
    availableSlots: 0
  });
  const [isLoading, setIsLoading] = useState(true);
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
    const loadStats = async () => {
      try {
        // Get today's date in Philippine Time (UTC+8)
        const phTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const today = phTime.toISOString().split('T')[0];
        
        console.log('📊 Loading stats for doctor:', doctorName);
        console.log('🇵🇭 Philippine Time:', phTime.toLocaleString('en-PH'));
        console.log('📅 Today\'s date (PH):', today);
        
        // Load doctor data to get max slots configuration
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
          
          console.log('✅ Doctor data loaded:', {
            id: doctorData.id,
            name: doctorData.name,
            maxSlots: doctorData.maxSlots
          });
          console.log('📊 Will query appointments with doctor name:', actualDoctorName);
        } else {
          console.warn('⚠️ Doctor not found in database');
          console.log('💡 Will try querying with provided name:', doctorName);
        }

        // Get today's appointments - Try multiple doctor name variations
        const appointmentsRef = collection(db, 'appointments');
        
        console.log('🔍 Querying appointments with:');
        console.log('   doctor =', actualDoctorName);
        console.log('   appointmentDate =', today);
        
        let appointmentsQuery = query(
          appointmentsRef,
          where('doctor', '==', actualDoctorName),
          where('appointmentDate', '==', today)
        );
        
        let querySnapshot = await getDocs(appointmentsQuery);
        
        // If no results and doctor name doesn't have "Dr.", try with "Dr." prefix
        if (querySnapshot.empty && !actualDoctorName.startsWith('Dr.')) {
          console.log('🔄 No results found. Trying with "Dr." prefix...');
          const nameWithDr = `Dr. ${actualDoctorName}`;
          console.log('   doctor =', nameWithDr);
          
          appointmentsQuery = query(
            appointmentsRef,
            where('doctor', '==', nameWithDr),
            where('appointmentDate', '==', today)
          );
          querySnapshot = await getDocs(appointmentsQuery);
          
          if (!querySnapshot.empty) {
            actualDoctorName = nameWithDr;
            console.log('✅ Found appointments with name:', nameWithDr);
          }
        }
        
        // If no results and doctor name has "Dr.", try without it
        if (querySnapshot.empty && actualDoctorName.startsWith('Dr.')) {
          console.log('🔄 No results found. Trying without "Dr." prefix...');
          const nameWithoutDr = actualDoctorName.replace(/^Dr\.\s*/i, '');
          console.log('   doctor =', nameWithoutDr);
          
          appointmentsQuery = query(
            appointmentsRef,
            where('doctor', '==', nameWithoutDr),
            where('appointmentDate', '==', today)
          );
          querySnapshot = await getDocs(appointmentsQuery);
          
          if (!querySnapshot.empty) {
            actualDoctorName = nameWithoutDr;
            console.log('✅ Found appointments with name:', nameWithoutDr);
          }
        }
        
        console.log('📊 Query returned', querySnapshot.docs.length, 'appointments');
        
        const appointments = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('📋 Appointment found:', {
            id: doc.id,
            date: data.appointmentDate,
            status: data.status,
            patient: data.fullName || 'Unknown',
            doctor: data.doctor
          });
          return {
            id: doc.id,
            ...data
          };
        }) as Appointment[];

        if (appointments.length === 0) {
          console.log('\n⚠️ === NO APPOINTMENTS FOUND ===');
          console.log('Possible reasons:');
          console.log('1. Date mismatch:');
          console.log('   System date (PH):', today);
          console.log('   Check if appointments exist for this date in Firebase');
          console.log('2. Doctor name tried:');
          console.log('   -', doctorName);
          console.log('   - Dr.', doctorName);
          console.log('   Make sure Firebase "doctor" field matches one of these');
          console.log('================================\n');
        }

        // Calculate stats - matching Home.tsx logic
        const todayAppointments = appointments.filter(apt => 
          apt.status !== 'cancelled'
        ).length;
        
        const pendingQueue = appointments.filter(apt => 
          apt.status === 'pending' || apt.status === 'scheduled' || apt.status === 'confirmed'
        ).length;
        
        const completedToday = appointments.filter(apt => 
          apt.status === 'completed'
        ).length;

        console.log('📊 Stats breakdown:');
        console.log('   Total appointments (non-cancelled):', todayAppointments);
        console.log('   Pending queue:', pendingQueue);
        console.log('   Completed:', completedToday);

        // Calculate available slots based on doctor's configuration
        let availableSlots = 0;
        
        if (doctorData) {
          // Check if doctor is completely unavailable for today
          const unavailableDates = doctorData.unavailableDates || {};
          
          if (unavailableDates[today]) {
            console.log('⛔ Doctor is unavailable today');
            availableSlots = 0;
          } else {
            // Get max slots for today (per-date override or global)
            const maxSlotsPerDate = doctorData.maxSlotsPerDate || {};
            const dateSpecificSlots = maxSlotsPerDate[today];
            const maxSlots = dateSpecificSlots !== undefined ? dateSpecificSlots : (doctorData.maxSlots || 0);
            
            console.log('📊 Max slots for today:', maxSlots, '(', dateSpecificSlots !== undefined ? 'date-specific' : 'global', ')');
            
            // Get unavailable time slots marked by staff
            const unavailableTimeSlots = doctorData.availableSlots?.[today] || [];
            console.log('⛔ Unavailable time slots:', unavailableTimeSlots.length);
            
            // Calculate total available slots
            const totalAvailableSlots = Math.max(0, maxSlots - unavailableTimeSlots.length);
            
            // Subtract booked appointments (excluding cancelled)
            const bookedSlots = appointments.filter(apt => apt.status !== 'cancelled').length;
            availableSlots = Math.max(0, totalAvailableSlots - bookedSlots);
            
            console.log('✨ Available slots calculation:');
            console.log('   Max slots configured:', maxSlots);
            console.log('   Unavailable time slots:', unavailableTimeSlots.length);
            console.log('   Total available slots:', totalAvailableSlots);
            console.log('   Booked appointments (non-cancelled):', bookedSlots);
            console.log('   Remaining available:', availableSlots);
          }
        } else {
          // Fallback if doctor data not found - use a default calculation
          const bookedSlots = appointments.filter(apt => apt.status !== 'cancelled').length;
          availableSlots = Math.max(0, 10 - bookedSlots);
          console.log('⚠️ Using fallback calculation: 10 - ' + bookedSlots + ' = ' + availableSlots);
        }

        setStats({
          todayAppointments,
          pendingQueue,
          completedToday,
          availableSlots
        });

        console.log('\n📊 === FINAL STATS ===');
        console.log('   Today\'s Appointments:', todayAppointments);
        console.log('   Pending in Queue:', pendingQueue);
        console.log('   Completed Today:', completedToday);
        console.log('   Available Slots:', availableSlots);
        console.log('======================\n');

      } catch (error) {
        console.error('❌ Error loading stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [doctorName]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
       {/* Welcome Section - Fixed mobile alignment */}
          <div className="text-center mb-12">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
              {greeting.icon}
              <h1 className="text-3xl sm:text-4xl font-bold text-black">
                {greeting.text},<br className="sm:hidden" /> Dr. {doctorName}!
              </h1>
            </div>
            <p className="text-lg sm:text-xl text-black max-w-2xl mx-auto px-4">
              Manage your appointments and patient queue efficiently with TimeFly's scheduling system.
            </p>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Today's Appointments */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.todayAppointments}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            {/* Pending Queue */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending in Queue</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.pendingQueue}</p>
                </div>
                <Users className="h-8 w-8 text-yellow-500" />
              </div>
            </div>

            {/* Completed Today */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Today</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.completedToday}</p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </div>

            {/* Available Slots */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Available Slots</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.availableSlots}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Center Calendar Button */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowCalendarModal(true)}
              className="bg-blue-600 text-white px-8 sm:px-12 py-4 sm:py-6 rounded-xl font-semibold text-base sm:text-lg hover:bg-blue-700 transition-all duration-300 shadow-lg flex items-center space-x-3 border border-blue-700"
            >
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8" />
              <span>View Calendar</span>
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