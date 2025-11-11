import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, AlertCircle, Search, Filter, Eye, RefreshCw, Trash2 } from 'lucide-react';
import { collection, query, getDocs, updateDoc, doc, orderBy, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import ViewAppointmentModal from './ViewAppointmentModal';
import RescheduleModal from './RescheduleModal';

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

const StaffAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState<string[]>([]);

  // Load doctors from Firebase
const loadDoctors = async () => {
  try {
    const doctorsRef = collection(db, 'doctors');
    const q = query(doctorsRef, where('isActive', '==', true));
    const querySnapshot = await getDocs(q);
    
    const doctorsData = querySnapshot.docs.map(doc => doc.data().name);
    setDoctors(doctorsData);
  } catch (error) {
    console.error('Error loading doctors:', error);
    alert('Failed to load doctors. Please check your permissions or try again.');
  }
};

useEffect(() => {
  loadAppointments();
  loadDoctors(); // Now this will work
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
        apt.phone.includes(query) ||
        apt.medicalCondition.toLowerCase().includes(query)
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

    // Doctor filter
    if (doctorFilter !== 'all') {
      filtered = filtered.filter(apt => apt.doctor === doctorFilter);
    }

    setFilteredAppointments(filtered);
  }, [appointments, searchQuery, statusFilter, priorityFilter, doctorFilter]);

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

  const loadAppointments = async () => {
    setIsLoading(true);
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, orderBy('createdAt', 'desc'));
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

      await loadAppointments();
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      alert('Appointment rescheduled successfully!');
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      alert('Failed to reschedule appointment. Please try again.');
    }
  };

  const handleDelete = async (appointment: Appointment) => {
    if (!confirm(`Are you sure you want to delete the appointment for ${appointment.fullName}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'appointments', appointment.id));
      await loadAppointments();
      alert('Appointment deleted successfully!');
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Failed to delete appointment. Please try again.');
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, { status });
      await loadAppointments();
      alert(`Appointment marked as ${status}!`);
    } catch (error) {
      console.error('Error updating appointment status:', error);
      alert('Failed to update appointment status. Please try again.');
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
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'scheduled': return 'bg-green-100 text-green-800';
    case 'rescheduled': return 'bg-blue-100 text-blue-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Appointments</h1>
          <p className="text-gray-600 mt-2">Manage and monitor all patient appointments</p>
        </div>

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
                  placeholder="Search by name, doctor, queue number, phone, or condition..."
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

          {/* Doctor Filter */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="doctorFilter" className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Doctor
              </label>
              <select
                id="doctorFilter"
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Doctors</option>
                {doctors.map((doctor) => (
                  <option key={doctor} value={doctor}>{doctor}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || doctorFilter !== 'all') && (
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
              {doctorFilter !== 'all' && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  Doctor: {doctorFilter}
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setDoctorFilter('all');
                }}
                className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Appointments Grid */}
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Appointments Found</h3>
            <p className="text-gray-500">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || doctorFilter !== 'all'
                ? 'No appointments match your current filters.'
                : 'No appointments have been booked yet.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 flex justify-between items-center">
                  <div className="text-white">
                    <p className="text-sm font-medium">Queue Number</p>
                    <p className="text-2xl font-bold">#{appointment.queueNumber}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
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
                      <User className="w-4 h-4" />
                      <span>{appointment.doctor}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{appointment.phone}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(appointment.priorityLevel)}`}>
                      <AlertCircle className="w-3 h-3" />
                      {appointment.priorityLevel}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Condition:</strong> {appointment.medicalCondition}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <button
                      onClick={() => handleView(appointment)}
                      className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    
                    {(appointment.status === 'pending' || appointment.status === 'scheduled') && (
                      <button
                        onClick={() => handleReschedule(appointment)}
                        className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reschedule
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(appointment)}
                      className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

              {/* Status Update Buttons */}
                {appointment.status !== 'confirmed' && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                <div className="flex gap-2 pt-2">
                    <button
                    onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                    >
                    Confirm
                    </button>
                    <button
                    onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
                    >
                    Cancel
                    </button>
                </div>
                )}
                </div>
              </div>
            ))}
          </div>
        )}
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
    </div>
  );
};

export default StaffAppointments;