import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle } from 'lucide-react';
import AppointmentModal from './AppointmentModal';
import CalendarWizardModal from './CalendarWizardModal';
import { collection, query, getDocs } from 'firebase/firestore';
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
}

const Home = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalendarWizardOpen, setIsCalendarWizardOpen] = useState(false);
  const [stats, setStats] = useState({
    upcomingAppointments: 0,
    pendingAppointments: 0,
    totalAppointments: 0
  });

  useEffect(() => {
    loadStats();
  }, [isModalOpen, isCalendarWizardOpen]);

  const loadStats = async () => {
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef);
      const querySnapshot = await getDocs(q);
      
      const appointments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const upcomingCount = appointments.filter((apt: Appointment) => {
        const aptDate = new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate >= today && apt.status !== 'completed' && apt.status !== 'cancelled';
      }).length;
      
      const pendingCount = appointments.filter((apt: Appointment) => 
        apt.status === 'pending'
      ).length;

      setStats({
        upcomingAppointments: upcomingCount,
        pendingAppointments: pendingCount,
        totalAppointments: appointments.length
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div className="min-h-screen">
     {/* Hero Section */}
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

      {/* Stats Section */}
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
            {/* Upcoming Appointments Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Calendar className="w-8 h-8 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Upcoming</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {stats.upcomingAppointments}
              </h3>
              <p className="text-sm text-gray-600">Upcoming Appointments</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">Scheduled future visits</p>
              </div>
            </div>

            {/* Pending Appointments Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Pending</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {stats.pendingAppointments}
              </h3>
              <p className="text-sm text-gray-600">Pending Appointments</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">Awaiting confirmation</p>
              </div>
            </div>

            {/* Total Appointments Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Total</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {stats.totalAppointments}
              </h3>
              <p className="text-sm text-gray-600">Total Appointments</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">All time bookings</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
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
            {/* Feature 1 */}
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

            {/* Feature 2 */}
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

            {/* Feature 3 */}
            <div className="text-center p-8 rounded-xl hover:bg-gray-50 transition-colors duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6">
                <CheckCircle className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Priority System
              </h3>
              <p className="text-gray-600">
                Emergency cases get immediate attention with our intelligent priority queue management system.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Appointment Modal */}
      <AppointmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      {/* Calendar Wizard Modal */}
      <CalendarWizardModal 
        isOpen={isCalendarWizardOpen} 
        onClose={() => setIsCalendarWizardOpen(false)} 
      />
    </div>
  );
};

export default Home;