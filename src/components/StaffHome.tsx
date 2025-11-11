import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, FileText } from 'lucide-react';
import AppointmentModal from './AppointmentModal';
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

interface StaffHomeProps {
  onNavigate: (page: 'home' | 'appointments' | 'queue' | 'doctors' | 'calendar' | 'reports' | 'waiting-list') => void;
}

const StaffHome = ({ onNavigate }: StaffHomeProps) => {
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [stats, setStats] = useState({
    todayPatients: 0,
    inProgress: 0,
    upcoming: 0,
    completed: 0
  });

  useEffect(() => {
    loadStats();
  }, [showAppointmentModal]);

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
      
      const todayCount = appointments.filter((apt: Appointment) => {
        const aptDate = new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.getTime() === today.getTime() && apt.status !== 'cancelled';
      }).length;
      
      const inProgressCount = appointments.filter((apt: Appointment) => 
        apt.status === 'in-progress'
      ).length;

      const upcomingCount = appointments.filter((apt: Appointment) => {
        const aptDate = new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate > today && apt.status !== 'completed' && apt.status !== 'cancelled';
      }).length;

      const completedCount = appointments.filter((apt: Appointment) => 
        apt.status === 'completed'
      ).length;

      setStats({
        todayPatients: todayCount,
        inProgress: inProgressCount,
        upcoming: upcomingCount,
        completed: completedCount
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section with Background */}
      <section className="staff-hero-section relative flex items-center justify-center overflow-hidden min-h-screen bg-cover bg-center bg-no-repeat bg-fixed">
        <div className="absolute inset-0 bg-black/30"></div>

        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto py-20">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
              Welcome Staff 
          </h1>
          
          <p className="text-xl sm:text-2xl text-white mb-12 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
            Manage appointments, monitor queues, and provide exceptional patient care
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button 
              onClick={() => setShowAppointmentModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-10 py-4 rounded-lg text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200"
            >
              Book Appointment
            </button>
            <button 
              onClick={() => onNavigate('queue')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-10 py-4 rounded-lg text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200"
            >
              Manage Queue
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
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
                <div className="p-3 bg-blue-100 rounded-lg">
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
               <div className="p-3 bg-yellow-100 rounded-lg">
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
                <div className="p-3 bg-orange-100 rounded-lg">
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
                <div className="p-3 bg-green-100 rounded-lg">
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

      {/* Quick Access Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Quick Access
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Streamline your workflow with instant access to key features
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div 
              onClick={() => onNavigate('appointments')}
              className="text-center p-8 rounded-xl hover:bg-gray-50 transition-colors duration-300 cursor-pointer"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-6">
                <Calendar className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Appointment Management
              </h3>
              <p className="text-gray-600">
                View, schedule, and manage all patient appointments efficiently.
              </p>
            </div>

            {/* Feature 2 */}
            <div 
              onClick={() => onNavigate('queue')}
              className="text-center p-8 rounded-xl hover:bg-gray-50 transition-colors duration-300 cursor-pointer"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Queue Monitoring
              </h3>
              <p className="text-gray-600">
                Track real-time queue status and optimize patient flow.
              </p>
            </div>

            {/* Feature 3 */}
            <div 
              onClick={() => onNavigate('reports')}
              className="text-center p-8 rounded-xl hover:bg-gray-50 transition-colors duration-300 cursor-pointer"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Reports & Analytics
              </h3>
              <p className="text-gray-600">
                Generate comprehensive reports and track performance metrics.
              </p>
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