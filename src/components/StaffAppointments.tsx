import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, AlertCircle, Search, Filter, Eye, RefreshCw, Trash2, X, ChevronUp, ChevronDown, Mail } from 'lucide-react';
import { collection, query, getDocs, updateDoc, doc, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import StaffViewAppointments from './StaffViewAppointments';
import RescheduleModal from './RescheduleModal';
import CancelModal from './CancelModal';
import ToastNotification from './ToastNotification';

type ToastType = 'success' | 'error' | 'warning' | 'info';
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

type SortField = 'appointmentDate' | 'timeSlot' | 'fullName' | 'doctor' | 'status' | 'queueNumber' | 'email';
type SortDirection = 'asc' | 'desc';

const StaffAppointments = () => {
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
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('appointmentDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  // Show toast notification
  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, isVisible: true });
  };

  // Use useEffect to call the functions on component mount
  useEffect(() => {
    const loadAppointments = async () => {
      setIsLoading(true);
      try {
        const appointmentsRef = collection(db, 'appointments');
        
        // Get current user's email
        const userEmail = auth.currentUser?.email;
        
        if (!userEmail) {
          console.error('No user email found');
          setIsLoading(false);
          return;
        }

        // Get user role from Firestore
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
        const userRole = userDoc.docs[0]?.data()?.role || 'patient';

        let q;
        
        // If staff or doctor, show all appointments
        if (userRole === 'staff' || userRole === 'doctor') {
          q = query(appointmentsRef, orderBy('createdAt', 'desc'));
        } else {
          // If patient, show only their appointments
          q = query(
            appointmentsRef, 
            where('email', '==', userEmail),
            orderBy('createdAt', 'desc')
          );
        }
        
        const querySnapshot = await getDocs(q);
        
        // Filter out appointments deleted by staff
        const appointmentsData = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Appointment))
          .filter(apt => !apt.deletedByStaff);
        
        setAppointments(appointmentsData);
      } catch (error) {
        console.error('Error loading appointments:', error);
        showToast('Failed to load appointments. Please try again.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const loadDoctors = async () => {
      try {
        const doctorsRef = collection(db, 'doctors');
        const q = query(doctorsRef, where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        
        const doctorsData = querySnapshot.docs.map(doc => doc.data().name);
        setDoctors(doctorsData);
      } catch (error) {
        console.error('Error loading doctors:', error);
        showToast('Failed to load doctors. Please check your permissions or try again.', 'error');
      }
    };

    loadAppointments();
    loadDoctors();
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
        apt.medicalCondition.toLowerCase().includes(query) ||
        apt.email.toLowerCase().includes(query)
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

    // Sorting
    filtered.sort((a, b) => {
      // Use type-safe approach with proper type checking
      let aValue: string | number = a[sortField];
      let bValue: string | number = b[sortField];

      if (sortField === 'appointmentDate') {
        // Convert date strings to timestamps for proper comparison
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }

      // Handle comparison based on sort direction
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredAppointments(filtered);
  }, [appointments, searchQuery, statusFilter, priorityFilter, doctorFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
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
      // First update Firebase
      const appointmentRef = doc(db, 'appointments', selectedAppointment.id);
      await updateDoc(appointmentRef, {
        appointmentDate: updatedData.appointmentDate,
        timeSlot: updatedData.timeSlot,
        status: 'rescheduled',
        rescheduledAt: new Date().toISOString()
      });

      console.log('✅ Firebase updated for reschedule');

      // Then send email notification
      const response = await fetch('/api/reschedule-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId: selectedAppointment.id,
          appointmentDate: updatedData.appointmentDate,
          timeSlot: updatedData.timeSlot,
          patientEmail: selectedAppointment.email,
          patientName: selectedAppointment.fullName,
          doctor: selectedAppointment.doctor,
          queueNumber: selectedAppointment.queueNumber,
          oldDate: selectedAppointment.appointmentDate,
          oldTimeSlot: selectedAppointment.timeSlot,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send reschedule email');
      }

      // Reload appointments to reflect real-time updates
      const loadAppointments = async () => {
        try {
          const appointmentsRef = collection(db, 'appointments');
          const userEmail = auth.currentUser?.email;
          
          if (!userEmail) return;

          const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
          const userRole = userDoc.docs[0]?.data()?.role || 'patient';

          let q;
          
          if (userRole === 'staff' || userRole === 'doctor') {
            q = query(appointmentsRef, orderBy('createdAt', 'desc'));
          } else {
            q = query(
              appointmentsRef, 
              where('email', '==', userEmail),
              orderBy('createdAt', 'desc')
            );
          }
          
          const querySnapshot = await getDocs(q);
          const appointmentsData = querySnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Appointment))
            .filter(apt => !apt.deletedByStaff);
          
          setAppointments(appointmentsData);
        } catch (error) {
          console.error('Error loading appointments:', error);
        }
      };

      await loadAppointments();
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      showToast('Appointment rescheduled successfully! Email notification sent.', 'success');
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      showToast(error instanceof Error ? error.message : 'Failed to reschedule appointment. Please try again.', 'error');
    }
  };

  const handleCancel = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancelModal(true);
  };

  const confirmCancel = async (reason: string) => {
    if (!selectedAppointment) return;

    try {
      // First update Firebase
      const appointmentRef = doc(db, 'appointments', selectedAppointment.id);
      await updateDoc(appointmentRef, {
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: new Date().toISOString()
      });

      console.log('✅ Firebase updated for cancellation');

      // Then send email notification
      const response = await fetch('/api/cancel-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId: selectedAppointment.id,
          cancelReason: reason,
          patientEmail: selectedAppointment.email,
          patientName: selectedAppointment.fullName,
          appointmentDate: selectedAppointment.appointmentDate,
          timeSlot: selectedAppointment.timeSlot,
          doctor: selectedAppointment.doctor,
          queueNumber: selectedAppointment.queueNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send cancellation email');
      }

      // Reload appointments to reflect real-time updates
      const loadAppointments = async () => {
        try {
          const appointmentsRef = collection(db, 'appointments');
          const userEmail = auth.currentUser?.email;
          
          if (!userEmail) return;

          const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
          const userRole = userDoc.docs[0]?.data()?.role || 'patient';

          let q;
          
          if (userRole === 'staff' || userRole === 'doctor') {
            q = query(appointmentsRef, orderBy('createdAt', 'desc'));
          } else {
            q = query(
              appointmentsRef, 
              where('email', '==', userEmail),
              orderBy('createdAt', 'desc')
            );
          }
          
          const querySnapshot = await getDocs(q);
          const appointmentsData = querySnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Appointment))
            .filter(apt => !apt.deletedByStaff);
          
          setAppointments(appointmentsData);
        } catch (error) {
          console.error('Error loading appointments:', error);
        }
      };

      await loadAppointments();
      setShowCancelModal(false);
      setSelectedAppointment(null);
      showToast('Appointment cancelled successfully! Email notification sent.', 'success');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      showToast(error instanceof Error ? error.message : 'Failed to cancel appointment. Please try again.', 'error');
    }
  };

  const handleDelete = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedAppointment) return;

    try {
      const appointmentRef = doc(db, 'appointments', selectedAppointment.id);
      await updateDoc(appointmentRef, {
        deletedByStaff: true
      });
      
      // Reload appointments to reflect real-time updates
      const loadAppointments = async () => {
        try {
          const appointmentsRef = collection(db, 'appointments');
          const userEmail = auth.currentUser?.email;
          
          if (!userEmail) return;

          const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
          const userRole = userDoc.docs[0]?.data()?.role || 'patient';

          let q;
          
          if (userRole === 'staff' || userRole === 'doctor') {
            q = query(appointmentsRef, orderBy('createdAt', 'desc'));
          } else {
            q = query(
              appointmentsRef, 
              where('email', '==', userEmail),
              orderBy('createdAt', 'desc')
            );
          }
          
          const querySnapshot = await getDocs(q);
          const appointmentsData = querySnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Appointment))
            .filter(apt => !apt.deletedByStaff);
          
          setAppointments(appointmentsData);
        } catch (error) {
          console.error('Error loading appointments:', error);
        }
      };

      await loadAppointments();
      setShowDeleteModal(false);
      setSelectedAppointment(null);
      showToast('Appointment deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting appointment:', error);
      showToast('Failed to delete appointment. Please try again.', 'error');
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
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'rescheduled': return 'bg-purple-100 text-purple-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'missed': return 'bg-red-100 text-red-800'; 
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

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
      {/* Toast Notification System */}
      <ToastNotification
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

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
                  placeholder="Search by name, doctor, queue number, phone, email, or condition..."
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
                <option value="confirmed">Confirmed</option>
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

        {/* Desktop Table View */}
        <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="queueNumber">
                    Queue
                  </SortableHeader>
                  <SortableHeader field="appointmentDate">
                    Date
                  </SortableHeader>
                  <SortableHeader field="timeSlot">
                    Time
                  </SortableHeader>
                  <SortableHeader field="fullName">
                    Patient
                  </SortableHeader>
                  <SortableHeader field="doctor">
                    Doctor
                  </SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <SortableHeader field="email">
                    Email
                  </SortableHeader>
                  <SortableHeader field="status">
                    Status
                  </SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAppointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">#{appointment.queueNumber}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(appointment.appointmentDate)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{convertTo12Hour(appointment.timeSlot)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {appointment.photo ? (
                          <img
                            src={appointment.photo}
                            alt="Patient"
                            className="w-8 h-8 rounded-full object-cover mr-3"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                            <User className="w-4 h-4 text-indigo-600" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{appointment.fullName}</div>
                          <div className="text-sm text-gray-500">{appointment.age} yrs, {appointment.gender}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{appointment.doctor}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{appointment.phone}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-900">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {appointment.email}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(appointment)}
                          className="text-indigo-600 hover:text-indigo-900 transition"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(appointment.status === 'pending' || appointment.status === 'scheduled') && (
                          <>
                            <button
                              onClick={() => handleReschedule(appointment)}
                              className="text-yellow-600 hover:text-yellow-900 transition"
                              title="Reschedule"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCancel(appointment)}
                              className="text-red-600 hover:text-red-900 transition"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(appointment)}
                          className="text-red-600 hover:text-red-900 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAppointments.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Appointments Found</h3>
              <p className="text-gray-500">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || doctorFilter !== 'all'
                  ? 'No appointments match your current filters.'
                  : 'No appointments have been booked yet.'}
              </p>
            </div>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {filteredAppointments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Appointments Found</h3>
              <p className="text-gray-500">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || doctorFilter !== 'all'
                  ? 'No appointments match your current filters.'
                  : 'No appointments have been booked yet.'}
              </p>
            </div>
          ) : (
            filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Header with Queue and Status */}
                <div className="bg-blue-600 px-4 py-3 flex justify-between items-center">
                  <div className="text-white">
                    <p className="text-sm font-medium">Queue Number</p>
                    <p className="text-xl font-bold">#{appointment.queueNumber}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                    {appointment.status}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Patient Info */}
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
                      <h3 className="font-semibold text-gray-900 text-lg">{appointment.fullName}</h3>
                      <p className="text-sm text-gray-500">{appointment.age} years, {appointment.gender}</p>
                    </div>
                  </div>

                  {/* Appointment Details */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(appointment.appointmentDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{convertTo12Hour(appointment.timeSlot)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{appointment.doctor}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{appointment.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{appointment.email}</span>
                    </div>
                  </div>

                  {/* Priority and Condition */}
                  <div className="pt-2 space-y-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(appointment.priorityLevel)}`}>
                      <AlertCircle className="w-3 h-3" />
                      {appointment.priorityLevel}
                    </span>
                    <p className="text-sm text-gray-600">
                      <strong>Condition:</strong> {appointment.medicalCondition}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3 border-t">
                    <button
                      onClick={() => handleView(appointment)}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    
                    {(appointment.status === 'pending' || appointment.status === 'scheduled') && (
                      <>
                        <button
                          onClick={() => handleReschedule(appointment)}
                          className="flex-1 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancel(appointment)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDelete(appointment)}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* View Modal */}
      {showViewModal && selectedAppointment && (
        <StaffViewAppointments
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onAppointmentUpdate={() => {
            // Reload appointments when modal updates
            const loadAppointments = async () => {
              try {
                const appointmentsRef = collection(db, 'appointments');
                const userEmail = auth.currentUser?.email;
                
                if (!userEmail) return;

                const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
                const userRole = userDoc.docs[0]?.data()?.role || 'patient';

                let q;
                
                if (userRole === 'staff' || userRole === 'doctor') {
                  q = query(appointmentsRef, orderBy('createdAt', 'desc'));
                } else {
                  q = query(
                    appointmentsRef, 
                    where('email', '==', userEmail),
                    orderBy('createdAt', 'desc')
                  );
                }
                
                const querySnapshot = await getDocs(q);
                const appointmentsData = querySnapshot.docs
                  .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  } as Appointment))
                  .filter(apt => !apt.deletedByStaff);
                
                setAppointments(appointmentsData);
              } catch (error) {
                console.error('Error loading appointments:', error);
              }
            };
            loadAppointments();
          }}
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
                onClick={() => setShowDeleteModal(false)}
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
                  onClick={() => setShowDeleteModal(false)}
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

export default StaffAppointments;