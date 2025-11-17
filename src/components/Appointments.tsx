import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, AlertCircle, Search, Filter, Stethoscope } from 'lucide-react';
import { collection, query, getDocs, updateDoc, doc, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import ViewAppointmentModal from './ViewAppointmentModal';
import RescheduleModal from './RescheduleModal';
import CancelModal from './CancelModal';

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
}

const Appointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAppointments();
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

const loadAppointments = async () => {
  setIsLoading(true);
  try {
    // Get current user's email from auth
    const userEmail = auth.currentUser?.email;
    
    if (!userEmail) {
      console.error('No user email found');
      setIsLoading(false);
      return;
    }

    const appointmentsRef = collection(db, 'appointments');
    // Filter appointments by current user's email
    const q = query(
      appointmentsRef, 
      where('email', '==', userEmail),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const appointmentsData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Appointment[];
    
    setAppointments(appointmentsData);
  } catch (error) {
    console.error('Error loading appointments:', error);
    alert('Failed to load appointments. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

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

      // Reload appointments
      await loadAppointments();
      
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      alert('Appointment rescheduled successfully!');
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      alert('Failed to reschedule appointment. Please try again.');
    }
  };

  const handleCancel = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancelModal(true);
  };

  const confirmCancel = async (reason: string) => {
    if (!selectedAppointment) return;

    try {
      const appointmentRef = doc(db, 'appointments', selectedAppointment.id);
      await updateDoc(appointmentRef, {
        status: 'cancelled',
        cancelReason: reason
      });

      // Reload appointments
      await loadAppointments();
      
      setShowCancelModal(false);
      setSelectedAppointment(null);
      alert('Appointment cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment. Please try again.');
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
      </div>
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
      {appointment.status}
    </span>
    </div>

    <div className="p-4 space-y-3">
      {/* Reminder Message */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-800 font-medium text-center">
          Please confirm if you can attend your appointment. Click the 'View' button to confirm.
        </p>
      </div>

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

        {showActions && (
        <div className="flex gap-2 pt-3">
          <button
            onClick={() => handleView(appointment)}
            className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg bg-white"
          >
            View
          </button>
          {(appointment.status === 'pending' || appointment.status === 'scheduled') && (
            <>
              <button
                onClick={() => handleReschedule(appointment)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg bg-white"
              >
                Reschedule
              </button>
              <button
                onClick={() => handleCancel(appointment)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg bg-white"
              >
                Cancel
              </button>
            </>
          )}
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
            onAppointmentUpdate={loadAppointments}
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
    </div>
  );
};

export default Appointments;