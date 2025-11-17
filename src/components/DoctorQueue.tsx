import { useState, useEffect } from 'react';
import { Clock, User, Phone, AlertCircle } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
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
  email: string;
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
  status: string;
  createdAt: string;
}

interface DoctorQueueProps {
  doctorName: string;
}

const DoctorQueue = ({ doctorName }: DoctorQueueProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [nowServing, setNowServing] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get today's date in Philippine timezone (UTC+8)
  const getTodayDatePH = (): string => {
    const now = new Date();
    const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const year = phTime.getFullYear();
    const month = String(phTime.getMonth() + 1).padStart(2, '0');
    const day = String(phTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for display
  const formatDateDisplay = (dateString: string): string => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const today = getTodayDatePH();
    const appointmentsRef = collection(db, 'appointments');
    
    // Query appointments for today and this specific doctor
    const q = query(
      appointmentsRef,
      where('appointmentDate', '==', today),
      where('doctor', '==', doctorName),
      orderBy('queueNumber', 'asc')
    );

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        try {
          const appointmentsData = querySnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Appointment[];
          
          // Filter out cancelled, completed, and missed appointments
          const filteredAppointments = appointmentsData.filter(apt => 
            apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'missed'
          );

          setAppointments(filteredAppointments);
          
          // Find currently serving appointment
          const currentlyServing = filteredAppointments.find(apt => 
            apt.status === 'serving' || apt.status === 'confirmed'
          );
          
          setNowServing(currentlyServing || null);
          setIsLoading(false);
        } catch (err) {
          console.error('Error processing queue data:', err);
          setError('Failed to process queue data');
          setIsLoading(false);
        }
      },
      (error) => {
        console.error('Error listening to queue:', error);
        setError('Failed to load queue. Please try again.');
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [doctorName]);

  const getUpNextAppointments = () => {
    if (!nowServing) return appointments.slice(0, 3);
    const currentIndex = appointments.findIndex(apt => apt.id === nowServing.id);
    return appointments.slice(currentIndex + 1, currentIndex + 4);
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
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const calculateWaitingTime = (timeSlot: string): string => {
    const now = new Date();
    const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const appointmentTime = new Date(phTime);
    appointmentTime.setHours(hours, minutes, 0, 0);
    
    const diffMs = appointmentTime.getTime() - phTime.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes > 0) {
      if (diffMinutes < 60) {
        return `${diffMinutes} min remaining`;
      } else {
        const hrs = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        if (mins === 0) {
          return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} remaining`;
        }
        return `${hrs}h ${mins}m remaining`;
      }
    } else if (diffMinutes === 0) {
      return 'Starting now';
    } else {
      const waitingMinutes = Math.abs(diffMinutes);
      if (waitingMinutes < 60) {
        return `Waiting ${waitingMinutes} min`;
      } else {
        const hrs = Math.floor(waitingMinutes / 60);
        const mins = waitingMinutes % 60;
        if (mins === 0) {
          return `Waiting ${hrs}h`;
        }
        return `Waiting ${hrs}h ${mins}m`;
      }
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Queue</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Patient Queue</h1>
          <p className="text-gray-600 mt-2">View today's patient queue in real-time</p>
          <p className="text-sm text-indigo-600 font-medium mt-1">
            {formatDateDisplay(getTodayDatePH())} • Dr. {doctorName}
          </p>
        </div>

        {/* Now Serving Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Now Serving</h2>
          {nowServing ? (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 p-3 rounded-full">
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Currently Serving</p>
                    <h3 className="text-3xl font-bold">{nowServing.fullName}</h3>
                    <p className="text-lg opacity-90">Queue #{nowServing.queueNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Appointment Time</p>
                  <p className="text-xl font-semibold">{convertTo12Hour(nowServing.timeSlot)}</p>
                  <p className="text-sm opacity-90 mt-1">
                    {nowServing.age} years • {nowServing.gender}
                  </p>
                </div>
              </div>
              
              {/* Patient Information */}
              <div className="mt-4 p-4 bg-white/10 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 opacity-80" />
                    <span>{nowServing.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 opacity-80" />
                    <span>{nowServing.medicalCondition}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-200 rounded-2xl p-8 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Patient Currently Being Served</h3>
              <p className="text-gray-500">Patients will appear here when they are being served</p>
            </div>
          )}
        </div>

        {/* Up Next Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Up Next</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {getUpNextAppointments().map((appointment) => (
              <div key={appointment.id} className="bg-white rounded-xl p-4 shadow-md border-l-4 border-yellow-500">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-yellow-600">#{appointment.queueNumber}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                    {appointment.priorityLevel}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{appointment.fullName}</h4>
                <p className="text-sm text-gray-600 mb-2">
                  {appointment.age} years • {appointment.gender}
                </p>
                <p className="text-sm text-gray-500">{convertTo12Hour(appointment.timeSlot)}</p>
                
                {/* Waiting Time */}
                <div className="mt-2 flex items-center gap-2 text-orange-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-semibold">{calculateWaitingTime(appointment.timeSlot)}</span>
                </div>
                
                {/* Status Display */}
                <div className="mt-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                    {appointment.status}
                  </span>
                </div>
              </div>
            ))}
            {getUpNextAppointments().length === 0 && (
              <div className="col-span-3 text-center py-8 text-gray-500">
                No more patients in queue
              </div>
            )}
          </div>
        </div>

        {/* Queue List Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Queue List ({appointments.length} patients)</h2>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">Queue is Empty</h3>
                <p className="text-gray-500">No patients in your queue for today</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full">
                          <span className="text-lg font-bold text-indigo-600">#{appointment.queueNumber}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{appointment.fullName}</h4>
                          <p className="text-sm text-gray-600">
                            {appointment.age} years • {appointment.gender}
                          </p>
                          <p className="text-sm text-gray-500">{convertTo12Hour(appointment.timeSlot)}</p>
                          
                          {/* Status and Waiting Time */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                              {appointment.status}
                            </span>
                            <span className="text-xs text-gray-300">•</span>
                            <div className="flex items-center gap-1 text-orange-600">
                              <Clock className="w-3 h-3" />
                              <span className="text-xs font-semibold">{calculateWaitingTime(appointment.timeSlot)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                          {appointment.priorityLevel}
                        </span>
                        
                        {(nowServing?.id === appointment.id) && (
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                            Now Serving
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Additional Information */}
                    <div className="mt-3 flex items-center text-sm text-gray-600">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {appointment.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {appointment.medicalCondition}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorQueue;