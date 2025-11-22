import { useState, useEffect } from 'react';
import { Clock, Calendar, User, AlertCircle, CheckCircle } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
  deletedByStaff?: boolean;  
  deletedByPatient?: boolean; 
}

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
  } else {
    return '0 min remaining';
  }
};

const Queue = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getTodayDatePH = (): string => {
    const now = new Date();
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
  useEffect(() => {
  setIsLoading(true);
  const today = getTodayDatePH();
  const appointmentsRef = collection(db, 'staff_appointments');
  
  // UPDATED: Only show active appointments in public queue
  const q = query(
    appointmentsRef,
    where('appointmentDate', '==', today),
    where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
  );
  
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      try {
        // FIXED: Changed from 'let' to 'const' since we're not reassigning
        const appointmentsData = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Appointment[];
        
        // Sort by queue number - using sort() which mutates the array in place
        appointmentsData.sort((a, b) => a.queueNumber - b.queueNumber);
        
        setAppointments(appointmentsData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error processing appointments:', error);
        setIsLoading(false);
      }
    },
    (error) => {
      console.error('Error loading appointments:', error);
      setIsLoading(false);
    }
  );
  
  return () => unsubscribe();
}, []);
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
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'missed': return 'bg-red-100 text-red-800'; 
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const nowServing = appointments.find(apt => apt.status === 'serving' || apt.status === 'confirmed');
  let upNext = null;
  if (nowServing) {
    const nowServingIndex = appointments.findIndex(apt => apt.id === nowServing.id);
    if (nowServingIndex >= 0 && nowServingIndex < appointments.length - 1) {
      upNext = appointments[nowServingIndex + 1];
    }
  }

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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Current Queue</h1>
          <p className="text-xl text-gray-600">Real-time queue status - All appointments for today</p>
          <p className="text-lg text-indigo-600 font-medium mt-2">{formatDate(getTodayDatePH())}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Now Serving</h2>
            </div>
            {nowServing ? (
              <div>
                <div className="text-6xl font-bold mb-2">#{nowServing.queueNumber}</div>
                <p className="text-xl mt-1">Patient #{nowServing.queueNumber}</p>
                <p className="text-sm opacity-75 mt-1">{convertTo12Hour(nowServing.timeSlot)}</p>
                <div className="mt-3">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(nowServing.priorityLevel)} bg-white/90`}>
                    <AlertCircle className="w-3 h-3" />
                    {nowServing.priorityLevel}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-2xl opacity-75">No one being served</div>
            )}
          </div>
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl shadow-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Up Next</h2>
            </div>
            {upNext ? (
              <div>
                <div className="text-6xl font-bold mb-2">#{upNext.queueNumber}</div>
                <p className="text-xl mt-1">Patient #{upNext.queueNumber}</p>
                <p className="text-sm opacity-75 mt-1">{convertTo12Hour(upNext.timeSlot)}</p>
                <div className="mt-3">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(upNext.priorityLevel)} bg-white/90`}>
                    <AlertCircle className="w-3 h-3" />
                    {upNext.priorityLevel}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-2xl opacity-75">No upcoming appointments</div>
            )}
          </div>
        </div>
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
                    appointment.status === 'serving' || appointment.status === 'confirmed'
                      ? 'bg-green-50 border-green-500 shadow-lg'
                      : 'bg-gray-50 border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="absolute -top-3 -left-3">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg ${
                      appointment.status === 'serving' || appointment.status === 'confirmed'
                        ? 'bg-green-500 text-white'
                        : 'bg-indigo-600 text-white'
                    }`}>
                      #{appointment.queueNumber}
                    </div>
                  </div>
                  <div className="ml-16 grid md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Patient #{appointment.queueNumber}</h3>
                          <p className="text-sm text-gray-600">Appointment</p>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4" />
                        <span className="font-semibold">{convertTo12Hour(appointment.timeSlot)}</span>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Waiting Time</span>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span className="font-bold text-orange-600">{calculateWaitingTime(appointment.timeSlot)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-5 flex flex-col gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold text-center ${getStatusColor(appointment.status)}`}>
                        {appointment.status === 'serving' ? 'Being Served' : 
                        appointment.status === 'confirmed' ? 'Confirmed' : 
                        appointment.status}
                      </span>
                      <span className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                        <AlertCircle className="w-3 h-3" />
                        {appointment.priorityLevel}
                      </span>
                    </div>
                  </div>
                  {(appointment.status === 'serving' || appointment.status === 'confirmed') && (
                    <div className="absolute top-2 right-2">
                      <span className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                        <CheckCircle className="w-4 h-4" />
                        {appointment.status === 'serving' ? 'Being Served' : 'Confirmed'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Queue Information</h3>
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
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> Patients are only moved to "Now Serving" when confirmed by staff. 
              Your position in the queue is determined by your appointment time and priority level.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Queue;