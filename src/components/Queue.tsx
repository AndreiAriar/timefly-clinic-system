import { useState, useEffect, useCallback } from 'react';
import { Clock, Calendar, User, AlertCircle, CheckCircle } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

interface Appointment {
  id: string;
  fullName: string;
  age: string;
  photo: string;
  doctor: string;
  appointmentDate: string;
  gender: string;
  medicalCondition: string;
  phone: string;
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
  status: string;
  createdAt: string;
}

const Queue = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get today's date in Philippine timezone (UTC+8)
  const getTodayDatePH = (): string => {
    const now = new Date();
    // Convert to Philippine time (UTC+8)
    const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const year = phTime.getFullYear();
    const month = String(phTime.getMonth() + 1).padStart(2, '0');
    const day = String(phTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const loadTodaysAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = getTodayDatePH();
      const appointmentsRef = collection(db, 'appointments');
      
      // Query all appointments for today
      const q = query(
        appointmentsRef,
        where('appointmentDate', '==', today)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Filter appointments that should be in the queue (excluding cancelled and completed)
      let appointmentsData = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Appointment[];
      
      // Filter out cancelled and completed appointments
      appointmentsData = appointmentsData.filter(apt => 
        apt.status !== 'cancelled' && apt.status !== 'completed'
      );
      
      // Sort by queue number
      appointmentsData.sort((a, b) => a.queueNumber - b.queueNumber);
      
      setAppointments(appointmentsData);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodaysAppointments();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadTodaysAppointments();
    }, 30000);
    return () => {
      clearInterval(interval);
    };
  }, [loadTodaysAppointments]);

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'serving': return 'bg-green-100 text-green-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const nowServing = appointments.find(apt => apt.status === 'serving');
  const upNext = appointments.find(apt => apt.status !== 'serving');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Current Queue</h1>
          <p className="text-xl text-gray-600">Real-time queue status - All appointments for today</p>
          <p className="text-lg text-indigo-600 font-medium mt-2">{formatDate(getTodayDatePH())}</p>
        </div>

        {/* Now Serving & Up Next Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Now Serving */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Now Serving</h2>
            </div>
            {nowServing ? (
              <div>
                <div className="text-6xl font-bold mb-2">#{nowServing.queueNumber}</div>
                <p className="text-lg opacity-90">{nowServing.fullName}</p>
                <p className="text-sm opacity-75">Dr. {nowServing.doctor}</p>
                <p className="text-sm opacity-75 mt-1">{convertTo12Hour(nowServing.timeSlot)}</p>
              </div>
            ) : (
              <div className="text-2xl opacity-75">No one being served</div>
            )}
          </div>

          {/* Up Next */}
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl shadow-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Up Next</h2>
            </div>
            {upNext ? (
              <div>
                <div className="text-6xl font-bold mb-2">#{upNext.queueNumber}</div>
                <p className="text-lg opacity-90">{upNext.fullName}</p>
                <p className="text-sm opacity-75">Dr. {upNext.doctor}</p>
                <p className="text-sm opacity-75 mt-1">{convertTo12Hour(upNext.timeSlot)}</p>
              </div>
            ) : (
              <div className="text-2xl opacity-75">No upcoming appointments</div>
            )}
          </div>
        </div>

        {/* Queue List */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Full Queue ({appointments.length})</h2>
          
          {appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl text-gray-600">No appointments in queue today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className={`relative border-2 rounded-xl p-6 transition-all ${
                    appointment.status === 'serving'
                      ? 'bg-green-50 border-green-500 shadow-lg'
                      : 'bg-gray-50 border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  {/* Queue Number Badge */}
                  <div className="absolute -top-3 -left-3">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg ${
                      appointment.status === 'serving'
                        ? 'bg-green-500 text-white'
                        : 'bg-indigo-600 text-white'
                    }`}>
                      #{appointment.queueNumber}
                    </div>
                  </div>

                  <div className="ml-16 grid md:grid-cols-12 gap-4 items-center">
                    {/* Patient Info */}
                    <div className="md:col-span-4">
                      <div className="flex items-center gap-3">
                        {appointment.photo ? (
                          <img
                            src={appointment.photo}
                            alt={appointment.fullName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-indigo-600" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">{appointment.fullName}</h3>
                          <p className="text-sm text-gray-600">Dr. {appointment.doctor}</p>
                        </div>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4" />
                        <span className="font-semibold">{convertTo12Hour(appointment.timeSlot)}</span>
                      </div>
                    </div>

                    {/* Status & Priority */}
                    <div className="md:col-span-3 flex flex-col gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold text-center ${getStatusColor(appointment.status)}`}>
                        {appointment.status === 'serving' ? 'Being Served' : appointment.status}
                      </span>
                      <span className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                        <AlertCircle className="w-3 h-3" />
                        {appointment.priorityLevel}
                      </span>
                    </div>

                    {/* Medical Condition */}
                    <div className="md:col-span-3">
                      <p className="text-sm text-gray-500">Condition:</p>
                      <p className="text-sm font-medium text-gray-700">{appointment.medicalCondition}</p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {appointment.status === 'serving' && (
                    <div className="absolute top-2 right-2">
                      <span className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                        <CheckCircle className="w-4 h-4" />
                        Being Served
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Priority Legend</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <div>
                <p className="font-medium text-gray-900">Emergency</p>
                <p className="text-sm text-gray-500">Immediate attention required</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
              <div>
                <p className="font-medium text-gray-900">Urgent</p>
                <p className="text-sm text-gray-500">Priority service needed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <div>
                <p className="font-medium text-gray-900">Normal</p>
                <p className="text-sm text-gray-500">Regular appointment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Queue;