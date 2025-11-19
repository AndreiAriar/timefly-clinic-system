import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, AlertCircle, Search, Filter, Stethoscope, Eye, X, Trash2 } from 'lucide-react';
import { collection, query, updateDoc, doc, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import ViewAppointmentModal from './ViewAppointmentModal';
import RescheduleModal from './RescheduleModal';
import CancelModal from './CancelModal';
import { toast } from 'react-toastify';

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
  cancelReason?: string;
  deletedByStaff?: boolean;
  deletedByPatient?: boolean;
  email: string;
}

const Appointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
  }, []);

  useEffect(() => {
    let filtered = [...appointments];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.fullName.toLowerCase().includes(query) ||
        apt.doctor.toLowerCase().includes(query) ||
        apt.queueNumber.toString().includes(query) ||
        apt.phone.includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(apt => apt.priorityLevel === priorityFilter);
    }
    setFilteredAppointments(filtered);
  }, [appointments, searchQuery, statusFilter, priorityFilter]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
useEffect(() => {
  // Get current user's email from auth
  const userEmail = auth.currentUser?.email;
  
  if (!userEmail) {
    console.error('No user email found');
    setIsLoading(false);
    return;
  }

  console.log('🔥 Setting up real-time listener for patient appointments...');

  // Real-time listener for appointments
  const appointmentsRef = collection(db, 'appointments');
  const q = query(
    appointmentsRef, 
    where('email', '==', userEmail),
    orderBy('createdAt', 'desc')
  );
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      // Filter out appointments deleted by patient
      const appointmentsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Appointment))
        .filter(apt => !apt.deletedByPatient);
      
      console.log('📊 Real-time update - Patient Appointments:', appointmentsData.length);
      setAppointments(appointmentsData);
      setIsLoading(false);
    },
    (error) => {
      console.error('❌ Error in appointments listener:', error);
      toast.error('Failed to load appointments. Please try again.', {
        position: "top-center",
        autoClose: 5000,
      });
      setIsLoading(false);
    }
  );

  // Cleanup function
  return () => {
    console.log('🔌 Cleaning up patient appointments listener');
    unsubscribe();
  };
}, []);

  // In Appointments.tsx - Update the filtering functions
  const getTodaysAppointments = () => {
    const today = getTodayDateString();
    return filteredAppointments.filter(apt => apt.appointmentDate === today);
  };

  const getMyAppointments = () => {
    return filteredAppointments; // Show all appointments to patient
  };

  const handleView = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowViewModal(true);
  };

  const handleReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowRescheduleModal(true);
  };

  const confirmReschedule = async (updatedData: { appointmentDate: string; timeSlot: string }) => {
  if (!selectedAppointment) return;

  try {
    const appointmentRef = doc(db, 'appointments', selectedAppointment.id);
    await updateDoc(appointmentRef, {
      appointmentDate: updatedData.appointmentDate,
      timeSlot: updatedData.timeSlot,
      status: 'rescheduled'
    });

    // Real-time listener will auto-update, no need to reload
    setShowRescheduleModal(false);
    setSelectedAppointment(null);
    toast.success('Appointment rescheduled successfully!', {
      position: "top-center",
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    toast.error('Failed to reschedule appointment. Please try again.', {
      position: "top-center",
      autoClose: 5000,
    });
  }
};

  const handleCancel = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancelModal(true);
  };

const handleDelete = (appointment: Appointment) => {
  setSelectedAppointment(appointment);
  setShowDeleteModal(true);
};

const confirmCancel = async (reason: string) => {
  if (!selectedAppointment) return;

  try {
    const appointmentRef = doc(db, 'appointments', selectedAppointment.id);
    await updateDoc(appointmentRef, {
      status: 'cancelled',
      cancelReason: reason
    });

    // Real-time listener will auto-update, no need to reload
    setShowCancelModal(false);
    setSelectedAppointment(null);
    toast.success('Appointment cancelled successfully!', {
      position: "top-center",
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    toast.error('Failed to cancel appointment. Please try again.', {
      position: "top-center",
      autoClose: 5000,
    });
  }
};

const confirmDelete = async () => {
  if (!selectedAppointment) return;

  try {
    const appointmentRef = doc(db, 'appointments', selectedAppointment.id);
    await updateDoc(appointmentRef, {
      deletedByPatient: true
    });

    // Real-time listener will auto-update, no need to reload
    setShowDeleteModal(false);
    setSelectedAppointment(null);
    toast.success('Appointment deleted successfully!', {
      position: "top-center",
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    toast.error('Failed to delete appointment. Please try again.', {
      position: "top-center",
      autoClose: 5000,
    });
  }
};

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'urgent': return 'bg-orange-100 text-orange-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-400 text-white';
      case 'scheduled': return 'bg-green-400 text-white';
      case 'rescheduled': return 'bg-blue-400 text-white';
      case 'cancelled': return 'bg-red-400 text-white';
      case 'confirmed': return 'bg-green-400 text-white';
      case 'serving': return 'bg-green-400 text-white';
      case 'completed': return 'bg-green-400 text-white';
      case 'missed': return 'bg-red-600 text-white'; 
      default: return 'bg-gray-300 text-white';
    }
  };

  const AppointmentCard = ({ appointment, showActions = true }: { appointment: Appointment; showActions?: boolean }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
      <div className="bg-blue-500 px-4 py-3 flex justify-between items-center">
        <div className="text-white">
          <p className="text-sm font-medium">Queue Number</p>
          <p className="text-3xl font-bold mt-1">#{appointment.queueNumber}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
          {appointment.status}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {appointment.photo ? (
            <img
              src={appointment.photo}
              alt="Patient"
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="w-6 h-6 text-indigo-600" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{appointment.fullName}</h3>
            <p className="text-sm text-gray-500">{appointment.age} years, {appointment.gender}</p>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(appointment.appointmentDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{convertTo12Hour(appointment.timeSlot)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Stethoscope className="w-4 h-4" />
            <span>{appointment.doctor}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4" />
            <span>{appointment.phone}</span>
          </div>
        </div>

        <div className="pt-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(appointment.priorityLevel)}`}>
            <AlertCircle className="w-3 h-3" />
            {appointment.priorityLevel}
          </span>
        </div>

        {/* Action Buttons - Text Only with Icons - 2 per row */}
        {showActions && (
          <div className="pt-4 border-t grid grid-cols-2 gap-2">
            <button
              onClick={() => handleView(appointment)}
              className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              <span>View</span>
            </button>
            <button
              onClick={() => handleReschedule(appointment)}
              className="flex items-center gap-2 px-3 py-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition text-sm font-medium"
            >
              <Calendar className="w-4 h-4" />
              <span>Reschedule</span>
            </button>
            <button
              onClick={() => handleCancel(appointment)}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
            <button
              onClick={() => handleDelete(appointment)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const todaysAppointments = getTodaysAppointments();
  const myAppointments = getMyAppointments();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search and Filter Section */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Appointments
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="search"
                  placeholder="Search by name, doctor, queue number, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Status
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label htmlFor="priorityFilter" className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Priority
              </label>
              <select
                id="priorityFilter"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchQuery && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  Search: "{searchQuery}"
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  Status: {statusFilter}
                </span>
              )}
              {priorityFilter !== 'all' && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  Priority: {priorityFilter}
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
                className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Today's Appointments Section */}
        <section className="mb-12">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Today's Appointments</h1>
            <p className="text-gray-600">
              Appointments scheduled for {formatDate(new Date().toLocaleDateString('en-CA'))} ({todaysAppointments.length})
            </p>
          </div>

          {todaysAppointments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Appointments Today</h3>
              <p className="text-gray-500">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' 
                  ? 'No appointments match your current filters.'
                  : 'You have no appointments scheduled for today.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {todaysAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </section>

        {/* My Appointments Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">My Appointments</h2>
            <p className="text-gray-600">All your appointments ({myAppointments.length})</p>
          </div>

          {myAppointments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Appointments Found</h3>
              <p className="text-gray-500">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' 
                  ? 'No appointments match your current filters.'
                  : 'You haven\'t booked any appointments yet.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {myAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* View Modal */}
      {showViewModal && selectedAppointment && (
        <ViewAppointmentModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
        />
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedAppointment && (
        <RescheduleModal
          isOpen={showRescheduleModal}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onConfirm={confirmReschedule}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedAppointment && (
        <CancelModal
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onConfirm={confirmCancel}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAppointment && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedAppointment(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete this appointment? This action cannot be undone.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedAppointment(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;