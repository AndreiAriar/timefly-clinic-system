import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, FileText, Sun, CloudSun, Moon } from 'lucide-react';
import AppointmentModal from './AppointmentModal';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

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
  deletedByStaff?: string;
  deletedByPatient?: string;
}

interface StaffHomeProps {
  onNavigate: (page: 'home' | 'appointments' | 'queue' | 'doctors' | 'calendar' | 'reports' | 'waiting-list') => void;
}

interface GreetingData {
  message: string;
  icon: React.ReactElement;
}

const StaffHome = ({ onNavigate }: StaffHomeProps) => {
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [stats, setStats] = useState({
    todayPatients: 0,
    inProgress: 0,
    upcoming: 0,
    completed: 0
  });
  const [greeting, setGreeting] = useState<GreetingData>({
    message: 'Welcome Staff',
    icon: <Sun className="w-12 h-12 text-yellow-300" />
  });

  const getPhilippineTime = (): Date => {
    // Philippine Time (UTC+8)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const phTime = new Date(utc + (8 * 3600000)); // UTC+8
    return phTime;
  };

  useEffect(() => {
    console.log('🔥 Setting up real-time listener for staff stats...');
    
    // Define updateGreeting inside useEffect to avoid dependency warning
    const updateGreeting = () => {
      const phTime = getPhilippineTime();
      const hour = phTime.getHours();

      let greetingData: GreetingData;

      if (hour >= 5 && hour < 12) {
        // Morning: 5:00 AM - 11:59 AM
        greetingData = {
          message: 'Good Morning Staff',
          icon: <Sun className="w-12 h-12 text-yellow-200" />
        };
      } else if (hour >= 12 && hour < 18) {
        // Afternoon: 12:00 PM - 5:59 PM
        greetingData = {
          message: 'Good Afternoon Staff',
          icon: <CloudSun className="w-12 h-12 text-orange-300" />
        };
      } else {
        // Evening: 6:00 PM - 4:59 AM
        greetingData = {
          message: 'Good Evening Staff',
          icon: <Moon className="w-12 h-12 text-blue-100" />
        };
      }

      setGreeting(greetingData);
    };

    updateGreeting();
    
    // Update greeting every minute to handle time changes
    const greetingInterval = setInterval(updateGreeting, 60000);

    // Real-time listener for appointments stats
    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter out deleted appointments
        const appointmentsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Appointment))
          .filter(apt => !apt.deletedByStaff && !apt.deletedByPatient);

        console.log('📊 Total appointments (after filtering):', appointmentsData.length);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayCount = appointmentsData.filter((apt: Appointment) => {
          const aptDate = new Date(apt.appointmentDate);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate.getTime() === today.getTime() && 
                 apt.status !== 'cancelled' &&
                 apt.status !== 'missed';
        }).length;
        
        const inProgressCount = appointmentsData.filter((apt: Appointment) => 
          apt.status === 'in-progress' || apt.status === 'serving'
        ).length;

        const upcomingCount = appointmentsData.filter((apt: Appointment) => {
          const aptDate = new Date(apt.appointmentDate);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate > today && 
                 apt.status !== 'completed' && 
                 apt.status !== 'cancelled' &&
                 apt.status !== 'missed';
        }).length;

        const completedCount = appointmentsData.filter((apt: Appointment) => 
          apt.status === 'completed'
        ).length;

        setStats({
          todayPatients: todayCount,
          inProgress: inProgressCount,
          upcoming: upcomingCount,
          completed: completedCount
        });

        console.log('✅ Real-time staff stats update:', {
          today: todayCount,
          inProgress: inProgressCount,
          upcoming: upcomingCount,
          completed: completedCount
        });
      },
      (error) => {
        console.error('❌ Error in staff stats listener:', error);
      }
    );
    
    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up staff stats listener');
      clearInterval(greetingInterval);
      unsubscribe();
    };
  }, []); 

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Solid Blue Background */}
      <section className="py-20 bg-blue-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Dynamic Greeting with Improved Icon Visibility */}
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-6">
              {/* Transparent circle with enhanced icon colors */}
              <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm shadow-lg border border-white/30">
                {greeting.icon}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                {greeting.message}
              </h1>
            </div>
          </div>
          
          <p className="text-xl sm:text-2xl text-white mb-12 max-w-3xl mx-auto leading-relaxed">
            Manage appointments, monitor queues, and provide exceptional patient care
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setShowAppointmentModal(true)}
              className="bg-white hover:bg-gray-100 text-indigo-600 font-semibold px-8 py-4 rounded-lg text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200"
            >
              Book Appointment
            </button>
            <button 
              onClick={() => onNavigate('queue')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-lg text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200 border border-white/20"
            >
              Manage Queue
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Today's Overview
            </h2>
            <p className="text-xl text-gray-600">
              Real-time statistics and patient management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Today's Patients */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Calendar className="w-8 h-8 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Today</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {stats.todayPatients}
              </h3>
              <p className="text-sm text-gray-600">Today's Patients</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">Scheduled appointments</p>
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-yellow-100 p-3 rounded-full">
                  <Users className="w-8 h-8 text-yellow-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Active</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {stats.inProgress}
              </h3>
              <p className="text-sm text-gray-600">In Progress</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">Currently consulting</p>
              </div>
            </div>

            {/* Upcoming */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 p-3 rounded-full">
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Pending</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {stats.upcoming}
              </h3>
              <p className="text-sm text-gray-600">Upcoming</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">Future appointments</p>
              </div>
            </div>

            {/* Completed */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-full">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Done</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {stats.completed}
              </h3>
              <p className="text-sm text-gray-600">Completed</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">Total consultations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Appointment Modal */}
      {showAppointmentModal && (
        <AppointmentModal
          isOpen={showAppointmentModal}
          onClose={() => setShowAppointmentModal(false)}
        />
      )}
    </div>
  );
};

export default StaffHome;