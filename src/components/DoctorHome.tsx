import { Calendar, Clock, Users, Activity, Sun, Cloud, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase/config';
import DoctorCalendarModal from './DoctorCalendarModal';

interface DoctorHomeProps {
  doctorName: string;
  onNavigateToAppointments: () => void;
  onNavigateToQueue: () => void;
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

const DoctorHome = ({ doctorName, onNavigateToAppointments }: DoctorHomeProps) => {
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