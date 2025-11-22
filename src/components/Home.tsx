import { useState, useEffect } from 'react';
import { Calendar, Clock, Users } from 'lucide-react';
import AppointmentModal from './AppointmentModal';
import CalendarWizardModal from './CalendarWizardModal';
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

const Home = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalendarWizardOpen, setIsCalendarWizardOpen] = useState(false);
  const [stats, setStats] = useState({
    todaysAppointments: 0,
    pendingAppointments: 0,
    totalAppointments: 0
  });

  // Get today's date in Philippine timezone (UTC+8)
  const getTodayDatePH = (): string => {
    const now = new Date();
    const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const year = phTime.getFullYear();
    const month = String(phTime.getMonth() + 1).padStart(2, '0');
    const day = String(phTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    console.log('🔥 Setting up real-time listener for home stats...');
    
    const today = getTodayDatePH();
    console.log('📅 Today\'s date (PH timezone):', today);
    
    const appointmentsRef = collection(db, 'patient_appointments');
    const q = query(appointmentsRef);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const appointments = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Appointment))
          .filter(apt => !apt.deletedByStaff && !apt.deletedByPatient);
        
        console.log('📊 Total appointments (after filtering):', appointments.length);
        
        // Count today's appointments
        const todaysCount = appointments.filter((apt: Appointment) => {
          const isTodayAppointment = apt.appointmentDate === today && 
                                     apt.status !== 'completed' && 
                                     apt.status !== 'cancelled' &&
                                     apt.status !== 'missed';
          return isTodayAppointment;
        }).length;
        
        const pendingCount = appointments.filter((apt: Appointment) => 
          apt.status === 'pending'
        ).length;
        
        setStats({
          todaysAppointments: todaysCount,
          pendingAppointments: pendingCount,
          totalAppointments: appointments.length
        });
        
        console.log('✅ Real-time stats update:', {
          today: todaysCount,
          pending: pendingCount,
          total: appointments.length
        });
      },
      (error) => {
        console.error('❌ Error in stats listener:', error);
      }
    );
    
    return () => {
      console.log('🔌 Cleaning up home stats listener');
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen">
      <section 
        className="hero-section relative flex items-center justify-center overflow-hidden min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto py-20">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
            Welcome to <span className="text-white drop-shadow-none">TimeFly</span>
          </h1>
          <p className="text-xl sm:text-3xl text-white mb-12 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
            Manage your eye care appointments and checkups with real-time queue updates.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-10 py-4 rounded-lg text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200"
            >
              Book an Appointment
            </button>
            <button 
              onClick={() => setIsCalendarWizardOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-10 py-4 rounded-lg text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200 flex items-center justify-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              View Calendar
            </button>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Your Healthcare Dashboard
            </h2>
            <p className="text-xl text-gray-600">
              Track your appointments and healthcare journey
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-blue-500 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="mb-4">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <span className="text-sm font-medium text-white opacity-90">Today</span>
              </div>
              <h3 className="text-3xl font-bold text-white text-center mb-2">
                {stats.todaysAppointments}
              </h3>
              <p className="text-sm text-white text-center opacity-90">Today's Appointments</p>
              <div className="mt-4 pt-4 border-t border-white/30">
                <p className="text-xs text-white opacity-100 text-center">Scheduled for today</p>
              </div>
            </div>
            <div className="bg-yellow-500 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="mb-4">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <span className="text-sm font-medium text-white opacity-90">Pending</span>
              </div>
              <h3 className="text-3xl font-bold text-white text-center mb-2">
                {stats.pendingAppointments}
              </h3>
              <p className="text-sm text-white text-center opacity-90">Pending Appointments</p>
              <div className="mt-4 pt-4 border-t border-white/30">
                <p className="text-xs text-white opacity-100 text-center">Awaiting confirmation</p>
              </div>
            </div>
            <div className="bg-green-500 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <span className="text-sm font-medium text-white opacity-90">Total</span>
              </div>
              <h3 className="text-3xl font-bold text-white text-center mb-2">
                {stats.totalAppointments}
              </h3>
              <p className="text-sm text-white text-center opacity-90">Total Appointments</p>
              <div className="mt-4 pt-4 border-t border-white/30">
                <p className="text-xs text-white opacity-100 text-center">All time bookings</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose TimeFly?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Experience seamless healthcare management with our innovative features
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-xl hover:bg-gray-50 transition-colors duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-6">
                <Calendar className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Easy Scheduling
              </h3>
              <p className="text-gray-600">
                Book appointments in seconds with our intuitive interface. Choose your preferred time slot and doctor.
              </p>
            </div>
            <div className="text-center p-8 rounded-xl hover:bg-gray-50 transition-colors duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
                <Clock className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Real-Time Updates
              </h3>
              <p className="text-gray-600">
                Stay informed with live queue updates and appointment reminders. Never miss an appointment.
              </p>
            </div>
            <div className="text-center p-8 rounded-xl hover:bg-gray-50 transition-colors duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Priority System
              </h3>
              <p className="text-gray-600">
                Our queue has special slots for urgent and emergency cases. They get quick attention without affecting other patients, so everyone still keeps their spot.
              </p>
            </div>
          </div>
        </div>
      </section>
      <AppointmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
      <CalendarWizardModal 
        isOpen={isCalendarWizardOpen} 
        onClose={() => setIsCalendarWizardOpen(false)} 
      />
    </div>
  );
};
export default Home;