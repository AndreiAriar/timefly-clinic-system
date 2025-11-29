import { useState, useEffect } from 'react';
import { Clock, User, Phone, AlertCircle } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
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

interface DoctorQueueProps {
  doctorName: string;
  isChristmasTheme?: boolean;
}

const DoctorQueue = ({ doctorName, isChristmasTheme = false }: DoctorQueueProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [nowServing, setNowServing] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get today's date in Philippine timezone (UTC+8)
  const getTodayDatePH = (): string => {
    try {
      const now = new Date();
      const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const year = phTime.getFullYear();
      const month = String(phTime.getMonth() + 1).padStart(2, '0');
      const day = String(phTime.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (err) {
      console.error('Error getting today date:', err);
      // Fallback to current date without timezone conversion
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  // Format date for display
  const formatDateDisplay = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Error formatting date display:', error);
      return 'Invalid Date';
    }
  };
useEffect(() => {
    setError(null);

    if (!doctorName) {
      console.warn('No doctor name provided');
      setAppointments([]);
      setNowServing(null);
      return;
    }

    const today = getTodayDatePH();
    
    // FIXED: Normalize doctor name for exact matching
    const normalizedDoctorName = doctorName.trim();
    
    const patientAppointmentsRef = collection(db, 'patient_appointments');
    const staffAppointmentsRef = collection(db, 'staff_appointments');
    
    // Query appointments for today and this EXACT doctor from both collections
    const patientQuery = query(
      patientAppointmentsRef,
      where('appointmentDate', '==', today),
      where('doctor', '==', normalizedDoctorName), // Use normalized name
      orderBy('queueNumber', 'asc')
    );

    const staffQuery = query(
      staffAppointmentsRef,
      where('appointmentDate', '==', today),
      where('doctor', '==', normalizedDoctorName), // Use normalized name
      orderBy('queueNumber', 'asc')
    );

    let allAppointments: Appointment[] = [];

    const updateQueueData = (appointments: Appointment[]) => {
      // Filter out cancelled, completed, missed appointments AND deleted appointments
      // CRITICAL: Also filter by exact doctor match
      const filteredAppointments = appointments.filter(apt => {
        const isDoctorMatch = apt.doctor.trim() === normalizedDoctorName;
        const isActiveStatus = apt.status !== 'cancelled' && 
                               apt.status !== 'completed' && 
                               apt.status !== 'missed';
        const isNotDeleted = !apt.deletedByStaff && !apt.deletedByPatient;
        
        return isDoctorMatch && isActiveStatus && isNotDeleted;
      });

      console.log(`📊 Filtered queue for Dr. ${normalizedDoctorName}:`, filteredAppointments.length);
      setAppointments(filteredAppointments);
      
      // Find currently serving appointment
      const currentlyServing = filteredAppointments.find(apt => 
        apt.status === 'serving' || apt.status === 'confirmed'
      );
      
      setNowServing(currentlyServing || null);
    };
      const handleAppointmentsUpdate = (snapshot: QuerySnapshot<DocumentData>, source: string) => {
        try {
          const newAppointments = snapshot.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: `${source}_${doc.id}`,
                originalId: doc.id,
                fullName: data.fullName || '',
                age: data.age || '',
                photo: data.photo || '',
                doctor: data.doctor || '',
                appointmentDate: data.appointmentDate || '',
                gender: data.gender || '',
                medicalCondition: data.medicalCondition || '',
                phone: data.phone || '',
                email: data.email || '',
                priorityLevel: data.priorityLevel || 'normal',
                timeSlot: data.timeSlot || '',
                queueNumber: data.queueNumber || 0,
                status: data.status || 'pending',
                createdAt: data.createdAt || '',
                deletedByStaff: data.deletedByStaff || false,
                deletedByPatient: data.deletedByPatient || false
              } as Appointment & { originalId: string };
            });

          console.log(`📊 ${source} appointments received:`, newAppointments.length);

          // Update the combined appointments array by filtering out old appointments from this source
          allAppointments = allAppointments.filter(apt => !apt.id.startsWith(`${source}_`));
          allAppointments = [...allAppointments, ...newAppointments];

          // Deduplicate based on appointment details (same date, time, patient, doctor)
         const uniqueAppointments = allAppointments.reduce((acc, current) => {
            const key = `${current.appointmentDate}_${current.timeSlot}_${current.fullName}_${current.doctor.trim()}_${current.queueNumber}`;
            
            // If this appointment key doesn't exist yet, add it
            if (!acc.has(key)) {
              acc.set(key, current);
            } else {
              // If duplicate exists, prefer the one from patient_appointments
              const existing = acc.get(key);
              if (existing && current.id.startsWith('patient_')) {
                acc.set(key, current);
              }
            }
            
            return acc;
          }, new Map<string, Appointment>());

          allAppointments = Array.from(uniqueAppointments.values());

          updateQueueData(allAppointments);
        } catch (err) {
          console.error('Error processing queue data:', err);
          setError('Failed to process queue data');
          setAppointments([]);
          setNowServing(null);
        }
      };

    // Subscribe to real-time updates from both collections
    const unsubscribePatient = onSnapshot(
      patientQuery,
      (querySnapshot) => {
        handleAppointmentsUpdate(querySnapshot, 'patient');
      },
      (error) => {
        console.error('Error listening to patient queue:', error);
        setError('Failed to load queue. Please try again.');
      }
    );

    const unsubscribeStaff = onSnapshot(
      staffQuery,
      (querySnapshot) => {
        handleAppointmentsUpdate(querySnapshot, 'staff');
      },
      (error) => {
        console.error('Error listening to staff queue:', error);
        setError('Failed to load queue. Please try again.');
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribePatient();
      unsubscribeStaff();
    };
  }, [doctorName]);

  const getUpNextAppointments = () => {
    if (!nowServing) return appointments.slice(0, 3);
    const currentIndex = appointments.findIndex(apt => apt.id === nowServing.id);
    if (currentIndex === -1) return appointments.slice(0, 3);
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
    if (!time24) return 'N/A';
    
    try {
      const [hours, minutes] = time24.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        return 'Invalid Time';
      }
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
      console.error('Error converting time:', error);
      return 'Invalid Time';
    }
  };

  const calculateWaitingTime = (timeSlot: string): string => {
    if (!timeSlot) return 'Time not set';
    
    try {
      const now = new Date();
      const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      
      const [hours, minutes] = timeSlot.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        return 'Invalid Time';
      }
      
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
    } catch (error) {
      console.error('Error calculating waiting time:', error);
      return 'Time calculation error';
    }
  };

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
  <div className={`min-h-screen ${isChristmasTheme ? 'bg-gradient-to-br from-red-50 to-green-50' : 'bg-gray-50'} py-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Patient Queue</h1>
          <p className="text-gray-600 mt-2">View today's patient queue in real-time</p>
          <p className="text-sm text-indigo-600 font-medium mt-1">
            {formatDateDisplay(getTodayDatePH())} • Dr. {doctorName || 'Unknown'}
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
                    <h3 className="text-3xl font-bold">{nowServing.fullName || 'Unknown Patient'}</h3>
                    <p className="text-lg opacity-90">Queue #{nowServing.queueNumber || 'N/A'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Appointment Time</p>
                  <p className="text-xl font-semibold">{convertTo12Hour(nowServing.timeSlot)}</p>
                  <p className="text-sm opacity-90 mt-1">
                    {nowServing.age || 'N/A'} years • {nowServing.gender || 'N/A'}
                  </p>
                </div>
              </div>
              
              {/* Patient Information */}
              <div className="mt-4 p-4 bg-white/10 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 opacity-80" />
                    <span>{nowServing.phone || 'No phone number'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 opacity-80" />
                    <span>{nowServing.medicalCondition || 'No condition specified'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-200 rounded-2xl p-8 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Patient Currently Being Served</h3>
              <p className="text-gray-500">
                {appointments.length > 0 
                  ? 'Patients in queue' 
                  : 'No patients in queue for today'}
              </p>
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
                  <span className="text-sm font-semibold text-yellow-600">#{appointment.queueNumber || 'N/A'}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                    {appointment.priorityLevel || 'normal'}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{appointment.fullName || 'Unknown Patient'}</h4>
                <p className="text-sm text-gray-600 mb-2">
                  {appointment.age || 'N/A'} years • {appointment.gender || 'N/A'}
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
                    {appointment.status || 'pending'}
                  </span>
                </div>
              </div>
            ))}
            {getUpNextAppointments().length === 0 && appointments.length > 0 && (
              <div className="col-span-3 text-center py-8 text-gray-500">
                No more patients in queue
              </div>
            )}
            {appointments.length === 0 && (
              <div className="col-span-3 text-center py-8 text-gray-500">
                No patients scheduled for today
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
                          <span className="text-lg font-bold text-indigo-600">#{appointment.queueNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{appointment.fullName || 'Unknown Patient'}</h4>
                          <p className="text-sm text-gray-600">
                            {appointment.age || 'N/A'} years • {appointment.gender || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-500">{convertTo12Hour(appointment.timeSlot)}</p>
                          
                          {/* Status and Waiting Time */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                              {appointment.status || 'pending'}
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
                          {appointment.priorityLevel || 'normal'}
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
                          {appointment.phone || 'No phone number'}
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {appointment.medicalCondition || 'No condition specified'}
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