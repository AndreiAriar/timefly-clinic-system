import { useState, useEffect, useCallback } from 'react';
import { Play, CheckCircle, Bell, Clock, User, Phone, AlertCircle, X } from 'lucide-react';
import { collection, query, getDocs, updateDoc, doc, where } from 'firebase/firestore';
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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

// Remove notification
const removeNotification = useCallback((id: string) => {
  setNotifications(prev => prev.filter(notif => notif.id !== id));
}, []);

// Add notification
const addNotification = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
  const id = Date.now().toString();
  setNotifications(prev => [...prev, { id, type, message }]);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    removeNotification(id);
  }, 5000);
}, [removeNotification]); // Add removeNotification as dependency

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

const loadQueue = useCallback(async () => {
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
    
    // Check if there's an appointment with status 'serving' or 'confirmed'
    const currentlyServing = appointmentsData.find(apt => apt.status === 'serving' || apt.status === 'confirmed');
    
    if (currentlyServing) {
      setNowServing(currentlyServing);
    } else {
      setNowServing(null);
    }
  } catch (error) {
    console.error('Error loading queue:', error);
    addNotification('error', 'Failed to load queue. Please try again.');
  } finally {
    setIsLoading(false);
  }
}, [addNotification]); // Added addNotification as dependency

  useEffect(() => {
    loadQueue();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadQueue();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadQueue]);

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
          }
          
          // Update the new appointment status to 'confirmed' (replaces the Confirm button functionality)
          const appointmentRef = doc(db, 'appointments', appointment.id);
          await updateDoc(appointmentRef, {
            status: 'confirmed'
          });
          
          setNowServing(appointment);
          
          // Reload the queue to reflect the status change
          await loadQueue();
          
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
          
          // Reload the queue
          await loadQueue();
        } catch (error) {
          console.error('Error completing appointment:', error);
          addNotification('error', 'Failed to complete appointment. Please try again.');
        }
      }
    );
  };

  const sendNotification = (appointment: Appointment) => {
    // In a real app, this would send a push notification or SMS
    addNotification('info', `Notification sent to ${appointment.fullName} (${appointment.phone}) - Queue #${appointment.queueNumber}`);
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

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
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
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Doctor</p>
                  <p className="text-xl font-semibold">{nowServing.doctor}</p>
                  <p className="text-sm opacity-90 mt-1">{convertTo12Hour(nowServing.timeSlot)}</p>
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
                  onClick={() => sendNotification(nowServing)}
                  className="flex-1 bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition flex items-center justify-center gap-2 border border-white/30"
                >
                  <Bell className="w-5 h-5" />
                  Send Reminder
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
                <p className="text-sm text-gray-600 mb-2">{appointment.doctor}</p>
                <p className="text-sm text-gray-500">{convertTo12Hour(appointment.timeSlot)}</p>
                <button
                  onClick={() => handleStartServing(appointment)}
                  className="w-full mt-3 bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start Serving
                </button>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full">
                          <span className="text-lg font-bold text-indigo-600">#{appointment.queueNumber}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{appointment.fullName}</h4>
                          <p className="text-sm text-gray-600">
                            {appointment.age} years • {appointment.gender} • {appointment.doctor}
                          </p>
                          <p className="text-sm text-gray-500">{convertTo12Hour(appointment.timeSlot)}</p>
                          <p className="text-xs text-gray-400 mt-1">Status: {appointment.status}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                          {appointment.priorityLevel}
                        </span>
                        
                        {(nowServing?.id !== appointment.id) && (
                          <button
                            onClick={() => handleStartServing(appointment)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            Serve
                          </button>
                        )}
                        
                        {(nowServing?.id === appointment.id) && (
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                            Now Serving
                          </span>
                        )}
                        
                        <button
                          onClick={() => sendNotification(appointment)}
                          className="p-2 text-gray-600 hover:text-indigo-600 transition"
                          title="Send Notification"
                        >
                          <Bell className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Additional Information */}
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
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
                      
                      {(nowServing?.id === appointment.id) && (
                        <button
                          onClick={() => handleComplete(appointment)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Complete
                        </button>
                      )}
                    </div>
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