import { useState, useEffect, useCallback } from 'react';
import { Play, CheckCircle, Bell, Clock, User, Phone, AlertCircle, X, Mail, Stethoscope } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
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

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface ConfirmDialog {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const StaffQueue = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [nowServing, setNowServing] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [sendingMissedNotification, setSendingMissedNotification] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Add notification - using stable reference
  const addNotification = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, type, message }]);
    
    // Auto remove after 5 seconds - use functional update to avoid dependency
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    }, 5000);
  }, []);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  // Show confirm dialog
  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

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

  // Format date for display (e.g., "November 11, 2025")
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
  
  const today = getTodayDatePH();
  const appointmentsRef = collection(db, 'appointments');
  
  const q = query(
    appointmentsRef,
    where('appointmentDate', '==', today)
  );
  
  // Subscribe to real-time updates
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      try {
        let appointmentsData = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            console.log('Appointment data:', data);
            return {
              id: doc.id,
              ...data
            };
          }) as Appointment[];
   
      // Filter out cancelled, completed, missed appointments AND deleted appointments
        appointmentsData = appointmentsData.filter(apt => 
          apt.status !== 'cancelled' && 
          apt.status !== 'completed' && 
          apt.status !== 'missed' &&
          !apt.deletedByStaff &&
          !apt.deletedByPatient
        );
        
        // Sort by queue number
        appointmentsData.sort((a, b) => a.queueNumber - b.queueNumber);
        
        setAppointments(appointmentsData);
        
        // Check if there's an appointment with status 'serving' or 'confirmed'
        const currentlyServing = appointmentsData.find(apt => apt.status === 'serving' || apt.status === 'confirmed');
        
        setNowServing(currentlyServing || null);
        setIsLoading(false);
      } catch (error) {
        console.error('Error processing queue:', error);
        addNotification('error', 'Failed to process queue data.');
        setIsLoading(false);
      }
    },
    (error) => {
      console.error('Error loading queue:', error);
      addNotification('error', 'Failed to load queue. Please try again.');
      setIsLoading(false);
    }
  );
  
  return () => unsubscribe();
}, [addNotification]);

  const handleStartServing = async (appointment: Appointment) => {
    showConfirmDialog(
      'Start Serving',
      `Start serving ${appointment.fullName} (Queue #${appointment.queueNumber})?`,
      async () => {
        try {
          // If there's already someone being served, update their status first
          if (nowServing && nowServing.id !== appointment.id) {
            const currentServingRef = doc(db, 'appointments', nowServing.id);
            await updateDoc(currentServingRef, {
              status: 'scheduled'
            });
            
            // Update local state for previous patient
            setAppointments(prev => 
              prev.map(apt => 
                apt.id === nowServing.id 
                  ? { ...apt, status: 'scheduled' } 
                  : apt
              )
            );
          }
          
          // Update the new appointment status to 'confirmed'
          const appointmentRef = doc(db, 'appointments', appointment.id);
          await updateDoc(appointmentRef, {
            status: 'confirmed'
          });
          
          // Update local state for new patient
          setAppointments(prev => 
            prev.map(apt => 
              apt.id === appointment.id 
                ? { ...apt, status: 'confirmed' } 
                : apt
            )
          );
          
          // Update nowServing with confirmed status
          setNowServing({ ...appointment, status: 'confirmed' });
          
          // Success message
          addNotification('success', `Now serving ${appointment.fullName} (Queue #${appointment.queueNumber})`);
        } catch (error) {
          console.error('Error starting service:', error);
          addNotification('error', 'Failed to start serving. Please try again.');
        }
      }
    );
  };

  const handleComplete = async (appointment: Appointment) => {
    showConfirmDialog(
      'Mark Complete',
      `Mark ${appointment.fullName}'s appointment as completed?`,
      async () => {
        try {
          const appointmentRef = doc(db, 'appointments', appointment.id);
          await updateDoc(appointmentRef, {
            status: 'completed'
          });
          
          // Remove from queue
          setAppointments(prev => prev.filter(apt => apt.id !== appointment.id));
          
          // If the completed appointment was the one being served, clear nowServing
          if (nowServing && nowServing.id === appointment.id) {
            setNowServing(null);
          }
          
          addNotification('success', `Appointment for ${appointment.fullName} marked as completed!`);
        } catch (error) {
          console.error('Error completing appointment:', error);
          addNotification('error', 'Failed to complete appointment. Please try again.');
        }
      }
    );
  };const handleMiss = async (appointment: Appointment) => {
  showConfirmDialog(
    'Mark as Missed',
    `Mark ${appointment.fullName}'s appointment as missed? This will move to the next patient and send an email notification.`,
    async () => {
      try {
        // First update Firebase status
        const appointmentRef = doc(db, 'appointments', appointment.id);
        await updateDoc(appointmentRef, {
          status: 'missed'
        });
        
        // Send email notification
        setSendingMissedNotification(appointment.id);
        try {
          const response = await fetch('/api/send-missed-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              patientEmail: appointment.email,
              patientName: appointment.fullName,
              appointmentDate: appointment.appointmentDate,
              timeSlot: appointment.timeSlot,
              doctor: appointment.doctor,
              queueNumber: appointment.queueNumber,
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            console.error('Failed to send missed notification:', data.error);
            // Continue with the process even if email fails
          }
        } catch (emailError) {
          console.error('Error sending missed notification:', emailError);
          // Continue with the process even if email fails
        } finally {
          setSendingMissedNotification(null);
        }

        // Remove from queue display (filter out missed appointments)
        setAppointments(prev => prev.filter(apt => apt.id !== appointment.id));
        
        // If the missed appointment was the one being served, clear nowServing
        if (nowServing && nowServing.id === appointment.id) {
          setNowServing(null);
        }
        
        addNotification('info', `${appointment.fullName} marked as missed (Queue #${appointment.queueNumber})`);
      } catch (error) {
        console.error('Error marking appointment as missed:', error);
        addNotification('error', 'Failed to mark as missed. Please try again.');
        setSendingMissedNotification(null);
      }
    }
  );
};

  const sendReminder = async (appointment: Appointment) => {
  // Use email field only
  if (!appointment.email) {
    addNotification('error', 'Patient email not available');
    return;
  }

  // Show confirm dialog before sending
  showConfirmDialog(
    'Send Reminder',
    `Send appointment reminder to ${appointment.fullName} at ${appointment.email}?`,
    async () => {
      setSendingReminder(appointment.id);

      try {
       const response = await fetch('/api/send-reminder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patientEmail: appointment.email,
            patientName: appointment.fullName,
            appointmentTime: convertTo12Hour(appointment.timeSlot),
            queueNumber: appointment.queueNumber
          }),
        });

        const data = await response.json();

        if (response.ok) {
          addNotification('success', `Reminder sent to ${appointment.fullName} at ${appointment.email}!`);
        } else {
          addNotification('error', data.error || 'Failed to send reminder');
        }
      } catch (error) {
        console.error('Error sending reminder:', error);
        addNotification('error', 'Network error. Please try again.');
      } finally {
        setSendingReminder(null);
      }
    }
  );
};

  const getUpNextAppointments = () => {
    if (!nowServing) return appointments.slice(0, 3);
    const currentIndex = appointments.findIndex(apt => apt.id === nowServing.id);
    return appointments.slice(currentIndex + 1, currentIndex + 4);
  };

  const getQueueList = () => {
    return appointments;
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
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'missed': return 'bg-red-100 text-red-800';
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
  
  // Calculate difference in minutes
  const diffMs = appointmentTime.getTime() - phTime.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes > 0) {
    // Appointment is in the future - show remaining time
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
    // Appointment time has passed or is now - show 0
    return '0 min remaining';
  }
};

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`${getNotificationColor(notification.type)} text-white px-6 py-4 rounded-lg shadow-lg flex items-center justify-between min-w-[300px] max-w-md animate-slide-in`}
            >
              <span className="flex-1">{notification.message}</span>
              <button
                onClick={() => removeNotification(notification.id)}
                className="ml-4 hover:bg-white/20 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Confirm Dialog */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmDialog.title}</h3>
              <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={confirmDialog.onCancel}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Current Queue</h1>
          <p className="text-gray-600 mt-2">Manage today's patient queue in real-time</p>
          <p className="text-sm text-indigo-600 font-medium mt-1">{formatDateDisplay(getTodayDatePH())}</p>
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
                    {/* Email in Now Serving Section */}
                    <div className="flex items-center gap-1 mt-1 opacity-90">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">{nowServing.email}</span>
                    </div>
                    {/* Phone number below email */}
                    <div className="flex items-center gap-1 mt-1 opacity-90">
                      <Phone className="w-4 h-4" />
                      <span className="text-sm">{nowServing.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Time</p>
                  <p className="text-sm opacity-90 mb-2">{convertTo12Hour(nowServing.timeSlot)}</p>
                  {/* Doctor with stethoscope icon */}
                  <div className="flex items-center gap-1 justify-end mb-2">
                    <Stethoscope className="w-4 h-4 opacity-90" />
                    <p className="text-sm opacity-90">Doctor</p>
                  </div>
                  <p className="text-xl font-semibold mb-2">{nowServing.doctor}</p>
                  {/* Medical condition aligned with other data */}
                  <div className="flex items-center gap-1 mt-2 opacity-90">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{nowServing.medicalCondition}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleComplete(nowServing)}
                  className="flex-1 bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Mark Complete
                </button>
               <button
                onClick={() => sendReminder(nowServing)}
                disabled={sendingReminder === nowServing.id}
                className={`flex-1 bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition flex items-center justify-center gap-2 border border-white/30 ${
                  sendingReminder === nowServing.id ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {sendingReminder === nowServing.id ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    Send Reminder
                  </>
                )}
              </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-200 rounded-2xl p-8 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Patient Currently Being Served</h3>
              <p className="text-gray-500">Start serving a patient from the queue list below</p>
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
                <p className="text-sm text-gray-500 mb-2">{convertTo12Hour(appointment.timeSlot)}</p>
                
                {/* Doctor with stethoscope icon */}
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                  <Stethoscope className="w-3 h-3" />
                  <span>{appointment.doctor}</span>
                </div>
                
                {/* Email in Up Next Section */}
                <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{appointment.email}</span>
                </div>
                
                {/* Phone number below email */}
                <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                  <Phone className="w-3 h-3" />
                  <span>{appointment.phone}</span>
                </div>
                
                {/* Medical condition aligned with other data */}
                <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
                  <AlertCircle className="w-3 h-3" />
                  <span className="truncate">{appointment.medicalCondition}</span>
                </div>
                
                {/* Status and Waiting Time below medical condition */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                    {appointment.status}
                  </span>
                  <div className="flex items-center gap-1 text-orange-600">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs font-semibold">{calculateWaitingTime(appointment.timeSlot)}</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartServing(appointment)}
                    className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Serve
                  </button>
                 <button
                onClick={() => handleMiss(appointment)}
                disabled={sendingMissedNotification === appointment.id}
                className={`bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition min-w-[70px] justify-center flex items-center gap-2 ${
                  sendingMissedNotification === appointment.id ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Mark as Missed"
              >
                {sendingMissedNotification === appointment.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="hidden sm:inline">Sending...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Miss</span>
                    <span className="sm:hidden">Miss</span>
                  </>
                )}
              </button>
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
            {getQueueList().length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">Queue is Empty</h3>
                <p className="text-gray-500">No patients in the queue for today</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {getQueueList().map((appointment) => (
                  <div key={appointment.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Left Section - Patient Info */}
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full">
                          <span className="text-lg font-bold text-indigo-600">#{appointment.queueNumber}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{appointment.fullName}</h4>
                          <p className="text-sm text-gray-600">
                            {appointment.age} years • {appointment.gender}
                          </p>
                          <p className="text-sm text-gray-500 mb-2">{convertTo12Hour(appointment.timeSlot)}</p>
                          
                          {/* Doctor with stethoscope icon */}
                          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                            <Stethoscope className="w-3 h-3" />
                            <span>{appointment.doctor}</span>
                          </div>
                          
                          {/* Email */}
                          <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                            <Mail className="w-3 h-3" />
                            <span>{appointment.email}</span>
                          </div>
                          
                          {/* Phone number below email */}
                          <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                            <Phone className="w-3 h-3" />
                            <span>{appointment.phone}</span>
                          </div>
                          
                          {/* Medical condition aligned with other data */}
                          <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{appointment.medicalCondition}</span>
                          </div>
                          
                          {/* Status and Waiting Time below medical condition */}
                          <div className="flex items-center gap-4 mt-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                              {appointment.status}
                            </span>
                            <div className="flex items-center gap-1 text-orange-600">
                              <Clock className="w-3 h-3" />
                              <span className="text-xs font-semibold">{calculateWaitingTime(appointment.timeSlot)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Section - Priority and Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-3 w-full lg:w-auto">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityColor(appointment.priorityLevel)} whitespace-nowrap`}>
                          {appointment.priorityLevel}
                        </span>
                        
                        <div className="flex items-center gap-2 justify-center">
                          {(nowServing?.id !== appointment.id) && (
                            <>
                              <button
                                onClick={() => handleStartServing(appointment)}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2 min-w-[80px] justify-center"
                              >
                                <Play className="w-4 h-4" />
                                <span className="hidden sm:inline">Serve</span>
                              </button>
                              <button
                                onClick={() => handleMiss(appointment)}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition min-w-[70px] justify-center"
                                title="Mark as Missed"
                              >
                                <span className="hidden sm:inline">Miss</span>
                                <span className="sm:hidden">Miss</span>
                              </button>
                            </>
                          )}
                          
                          {(nowServing?.id === appointment.id) && (
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                              Now Serving
                            </span>
                          )}
                          
                          <button
                            onClick={() => sendReminder(appointment)}
                            disabled={sendingReminder === appointment.id}
                            className={`p-2 text-gray-600 hover:text-indigo-600 transition ${
                              sendingReminder === appointment.id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Send Reminder"
                          >
                            {sendingReminder === appointment.id ? (
                              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Bell className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action buttons for currently serving patient */}
                    {(nowServing?.id === appointment.id) && (
                      <div className="mt-3 flex justify-center lg:justify-end">
                        <button
                          onClick={() => handleComplete(appointment)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Complete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default StaffQueue;