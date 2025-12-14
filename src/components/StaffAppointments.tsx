import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, AlertCircle, Search, Filter, Eye, RefreshCw, Trash2, X, ChevronUp, ChevronDown, Mail, MoreVertical } from 'lucide-react';
import { collection, query, getDocs, updateDoc, doc, orderBy, where, onSnapshot, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import StaffViewAppointments from './StaffViewAppointments';
import StaffRescheduleModal from './StaffRescheduleModal';
import StaffCancel from './StaffCancel';
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
  const [showStaffCancelModal, setShowStaffCancelModal] = useState(false);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState<string | null>(null);

  // Show toast notification
  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, isVisible: true });
  };

  useEffect(() => {
    console.log('🔥 Setting up real-time listeners for staff...');
    
    const userEmail = auth.currentUser?.email;
    
    if (!userEmail) {
      console.error('No user email found');
      setIsLoading(false);
      return;
    }

    let unsubscribeAppointments: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
        const userRole = userDoc.docs[0]?.data()?.role || 'patient';

        const appointmentsRef = collection(db, 'staff_appointments');
        let appointmentsQuery;
        
        if (userRole === 'staff' || userRole === 'doctor') {
          appointmentsQuery = query(appointmentsRef, orderBy('createdAt', 'desc'));
        } else {
          appointmentsQuery = query(
            appointmentsRef, 
            where('email', '==', userEmail),
            orderBy('createdAt', 'desc')
          );
        }
        
        unsubscribeAppointments = onSnapshot(
          appointmentsQuery,
          (snapshot) => {
            const appointmentsData = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              } as Appointment));
            
            console.log('📊 Real-time update - Staff Appointments (all):', appointmentsData.length);
            setAppointments(appointmentsData);
            setIsLoading(false);
          },
          (error) => {
            console.error('❌ Error in appointments listener:', error);
            showToast('Failed to load appointments. Please try again.', 'error');
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Error setting up listeners:', error);
        showToast('Failed to load appointments. Please try again.', 'error');
        setIsLoading(false);
      }
    };

    setupListeners();

    const loadDoctors = async () => {
      try {
        const doctorsRef = collection(db, 'doctors');
        const q = query(doctorsRef, where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        
        const doctorsData = querySnapshot.docs.map(doc => doc.data().name);
        setDoctors(doctorsData);
      } catch {
        console.error('Error loading doctors:');
        showToast('Failed to load doctors. Please check your permissions or try again.', 'error');
      }
    };

    loadDoctors();

    return () => {
      console.log('🔌 Cleaning up staff appointments listener');
      if (unsubscribeAppointments) {
        unsubscribeAppointments();
      }
    };
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
      let aValue: string | number = a[sortField];
      let bValue: string | number = b[sortField];

      if (sortField === 'appointmentDate') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }

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
    setShowMobileActions(null);
  };

  const handleReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowRescheduleModal(true);
    setShowMobileActions(null);
  };

  const handleCancel = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowStaffCancelModal(true);
    setShowMobileActions(null);
  };

  const handleDelete = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDeleteModal(true);
    setShowMobileActions(null);
  };

  const confirmReschedule = async (updatedData: { appointmentDate: string; timeSlot: string; rescheduleReason: string }) => {
    if (!selectedAppointment) return;

    setIsSubmitting(true);
    try {
      // Update both staff and patient collections
      const staffAppointmentRef = doc(db, 'staff_appointments', selectedAppointment.id);
      const patientAppointmentRef = doc(db, 'patient_appointments', selectedAppointment.id);
      
      const updateData = {
        appointmentDate: updatedData.appointmentDate,
        timeSlot: updatedData.timeSlot,
        status: 'rescheduled',
        rescheduledAt: new Date().toISOString(),
        rescheduleReason: updatedData.rescheduleReason,
        rescheduledBy: 'staff'
      };

      await updateDoc(staffAppointmentRef, updateData);
      await updateDoc(patientAppointmentRef, updateData);

      console.log('✅ Firebase updated for reschedule');

      // FREE THE OLD TIME SLOT: Delete the old slot lock
      const oldSlotLockRef = doc(db, 'slot_locks', `${selectedAppointment.doctor}_${selectedAppointment.appointmentDate}_${selectedAppointment.timeSlot}`);
      try {
        await deleteDoc(oldSlotLockRef);
        console.log('✅ Old slot lock removed - old time slot is now available');
      } catch {
        console.log('ℹ️ No old slot lock found or already deleted');
      }

      // CREATE NEW SLOT LOCK for the new time
      const newSlotLockRef = doc(db, 'slot_locks', `${selectedAppointment.doctor}_${updatedData.appointmentDate}_${updatedData.timeSlot}`);
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(newSlotLockRef, {
          doctor: selectedAppointment.doctor,
          appointmentDate: updatedData.appointmentDate,
          timeSlot: updatedData.timeSlot,
          appointmentId: selectedAppointment.id,
          bookedAt: new Date().toISOString(),
          bookedBy: selectedAppointment.email,
          rescheduledFrom: {
            date: selectedAppointment.appointmentDate,
            timeSlot: selectedAppointment.timeSlot
          },
          rescheduleReason: updatedData.rescheduleReason
        });
        console.log('✅ New slot lock created for rescheduled appointment');
      } catch (error) {
        console.error('⚠️ Failed to create new slot lock:', error);
      }

      // Update booking counters if date changed
      if (selectedAppointment.appointmentDate !== updatedData.appointmentDate) {
        // Decrement old date counter
        const oldCounterRef = doc(db, 'booking_counters', `${selectedAppointment.doctor}_${selectedAppointment.appointmentDate}`);
        try {
          const oldCounterDoc = await getDoc(oldCounterRef);
          if (oldCounterDoc.exists()) {
            const currentCount = oldCounterDoc.data()?.count || 0;
            if (currentCount > 0) {
              await updateDoc(oldCounterRef, { count: currentCount - 1 });
              console.log('✅ Old date booking counter decremented');
            }
          }
        } catch {
          console.log('ℹ️ No old booking counter found');
        }

        // Increment new date counter
        const newCounterRef = doc(db, 'booking_counters', `${selectedAppointment.doctor}_${updatedData.appointmentDate}`);
        try {
          const newCounterDoc = await getDoc(newCounterRef);
          if (newCounterDoc.exists()) {
            const currentCount = newCounterDoc.data()?.count || 0;
            await updateDoc(newCounterRef, { count: currentCount + 1 });
          } else {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(newCounterRef, {
              doctor: selectedAppointment.doctor,
              date: updatedData.appointmentDate,
              count: 1
            });
          }
          console.log('✅ New date booking counter updated');
        } catch {
          console.log('ℹ️ Failed to update new booking counter');
        }
      }

      // Send email notifications to both staff and patient
      const staffResponse = await fetch('/api/staff-reschedule-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientEmail: selectedAppointment.email,
          patientName: selectedAppointment.fullName,
          originalAppointmentDate: selectedAppointment.appointmentDate,
          originalTimeSlot: selectedAppointment.timeSlot,
          newAppointmentDate: updatedData.appointmentDate,
          newTimeSlot: updatedData.timeSlot,
          doctor: selectedAppointment.doctor,
          queueNumber: selectedAppointment.queueNumber,
          rescheduleReason: updatedData.rescheduleReason,
          rescheduledBy: 'staff'
        }),
      });

      const staffData = await staffResponse.json();

      if (!staffResponse.ok || !staffData.success) {
        console.error('Staff email notification failed:', staffData.error);
      }

      // Also send notification to patient using the existing endpoint
      const patientResponse = await fetch('/api/reschedule-appointment', {
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
          rescheduleReason: updatedData.rescheduleReason
        }),
      });

      const patientData = await patientResponse.json();

      if (!patientResponse.ok || !patientData.success) {
        console.error('Patient email notification failed:', patientData.error);
      }

      // Real-time listener will auto-update appointments
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      showToast('Appointment rescheduled successfully! Notifications sent to staff and patient.', 'success');
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      showToast(error instanceof Error ? error.message : 'Failed to reschedule appointment. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmCancel = async (reason: string) => {
    if (!selectedAppointment) return;

    try {
      const staffAppointmentRef = doc(db, 'staff_appointments', selectedAppointment.id);
      const patientAppointmentRef = doc(db, 'patient_appointments', selectedAppointment.id);
      
      const updateData = {
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: new Date().toISOString()
      };

      await updateDoc(staffAppointmentRef, updateData);
      await updateDoc(patientAppointmentRef, updateData);

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

      setShowStaffCancelModal(false);
      setSelectedAppointment(null);
      showToast('Appointment cancelled successfully! Email notification sent.', 'success');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      showToast(error instanceof Error ? error.message : 'Failed to cancel appointment. Please try again.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!selectedAppointment) return;

    try {
      const staffAppointmentRef = doc(db, 'staff_appointments', selectedAppointment.id);
      
      const appointmentDoc = await getDoc(staffAppointmentRef);
      
      if (!appointmentDoc.exists()) {
        showToast('Appointment not found.', 'error');
        setShowDeleteModal(false);
        return;
      }

      const appointmentData = appointmentDoc.data();
      const isStaffBooked = appointmentData?.bookedByStaff === true;

      await deleteDoc(staffAppointmentRef);
      console.log('✅ Deleted from staff_appointments');
      
      if (isStaffBooked) {
        try {
          const patientAppointmentRef = doc(db, 'patient_appointments', selectedAppointment.id);
          await deleteDoc(patientAppointmentRef);
          console.log('✅ Deleted staff-booked appointment from patient_appointments');
        } catch {
          console.log('ℹ️ Patient appointment not found or already deleted');
        }
      } else {
        console.log('ℹ️ Patient-booked appointment: Left patient_appointments intact');
      }

      const slotLockRef = doc(db, 'slot_locks', `${selectedAppointment.doctor}_${selectedAppointment.appointmentDate}_${selectedAppointment.timeSlot}`);
      try {
        await deleteDoc(slotLockRef);
        console.log('✅ Slot lock removed - time slot is now available');
      } catch {
        console.log('ℹ️ No slot lock found or already deleted');
      }

      setShowDeleteModal(false);
      setSelectedAppointment(null);
      showToast('Appointment permanently deleted!', 'success');
    } catch (error) {
      console.error('Error deleting appointment:', error);
      showToast('Failed to delete appointment. Please try again.', 'error');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-100 text-red-800 border border-red-200';
      case 'urgent': return 'bg-orange-100 text-orange-800 border border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border border-blue-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border border-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'rescheduled': return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border border-red-200';
      case 'completed': return 'bg-green-100 text-green-700 border border-green-200';
      case 'missed': return 'bg-red-100 text-red-800 border border-red-200'; 
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th 
      className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        <span className="whitespace-nowrap">{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      {/* Toast Notification System */}
      <ToastNotification
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 px-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">All Appointments</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Manage and monitor all patient appointments</p>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-6 sm:mb-8 bg-white rounded-lg shadow-sm sm:shadow-md p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Appointments
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  id="search"
                  placeholder="Search by name, doctor, queue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
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
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>

          {/* Doctor Filter */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <label htmlFor="doctorFilter" className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Doctor
              </label>
              <select
                id="doctorFilter"
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                <span className="px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs sm:text-sm">
                  Search: "{searchQuery}"
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs sm:text-sm">
                  Status: {statusFilter}
                </span>
              )}
              {priorityFilter !== 'all' && (
                <span className="px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs sm:text-sm">
                  Priority: {priorityFilter}
                </span>
              )}
              {doctorFilter !== 'all' && (
                <span className="px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs sm:text-sm">
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
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
     {/* Desktop Table View (for md screens and up) */}
    <div className="hidden md:block bg-white rounded-lg shadow-sm sm:shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-full inline-block align-middle">
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
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                {/* ✅ ADDED: Email column header */}
                <SortableHeader field="email">
                  Email
                </SortableHeader>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAppointments.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-gray-50 transition">
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                    <div className="text-sm font-semibold text-gray-900">#{appointment.queueNumber}</div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                    <div className="text-sm text-gray-900 whitespace-nowrap">{formatDate(appointment.appointmentDate)}</div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                    <div className="text-sm text-gray-900 whitespace-nowrap">{convertTo12Hour(appointment.timeSlot)}</div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                    <div className="flex items-center min-w-0">
                      {appointment.photo ? (
                        <img
                          src={appointment.photo}
                          alt="Patient"
                          className="w-8 h-8 rounded-full object-cover mr-3 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 flex-shrink-0">
                          <User className="w-4 h-4 text-indigo-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{appointment.fullName}</div>
                        <div className="text-xs text-gray-500 truncate">{appointment.age} yrs, {appointment.gender}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                    <div className="text-sm text-gray-900 truncate max-w-[120px]">{appointment.doctor}</div>
                  </td>
                  {/* ✅ UPDATED: Contact column - phone only */}
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                    <div className="text-sm text-gray-900 truncate max-w-[100px]">{appointment.phone}</div>
                  </td>
                  {/* ✅ FIXED: Email column - shows full email */}
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                    <div className="text-sm text-gray-900 break-words min-w-[180px] max-w-[250px]">
                      {appointment.email}
                    </div>
                  </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleView(appointment)}
                      className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {(appointment.status === 'pending' || appointment.status === 'scheduled') && (
                      <>
                        <button
                          onClick={() => handleReschedule(appointment)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 rounded transition"
                          title="Reschedule"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCancel(appointment)}
                          className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(appointment)}
                      className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition"
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
      </div>

      {filteredAppointments.length === 0 && (
        <div className="text-center py-12 px-4">
          <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">No Appointments Found</h3>
          <p className="text-gray-500 text-sm sm:text-base">
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || doctorFilter !== 'all'
              ? 'No appointments match your current filters.'
              : 'No appointments have been booked yet.'}
          </p>
        </div>
      )}
    </div>

        {/* Tablet and Mobile Card View */}
        <div className="md:hidden space-y-4">
          {filteredAppointments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm sm:shadow-md p-6 sm:p-8 text-center">
              <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">No Appointments Found</h3>
              <p className="text-gray-500 text-sm sm:text-base">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || doctorFilter !== 'all'
                  ? 'No appointments match your current filters.'
                  : 'No appointments have been booked yet.'}
              </p>
            </div>
          ) : (
            filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="bg-white rounded-lg shadow-sm sm:shadow-md overflow-hidden border border-gray-100">
                {/* Header with Queue and Status */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex justify-between items-center">
                  <div className="text-white">
                    <p className="text-xs font-medium">Queue #</p>
                    <p className="text-xl font-bold">#{appointment.queueNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                      {appointment.status}
                    </span>
                    <button
                      onClick={() => setShowMobileActions(showMobileActions === appointment.id ? null : appointment.id)}
                      className="p-1 text-white hover:bg-white/10 rounded"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Action Menu (Mobile) */}
                {showMobileActions === appointment.id && (
                  <div className="bg-gray-50 px-4 py-2 border-b flex gap-2 overflow-x-auto">
                    <button
                      onClick={() => handleView(appointment)}
                      className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                    {(appointment.status === 'pending' || appointment.status === 'scheduled') && (
                      <>
                        <button
                          onClick={() => handleReschedule(appointment)}
                          className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancel(appointment)}
                          className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(appointment)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Patient Info */}
                  <div className="flex items-start gap-3">
                    {appointment.photo ? (
                      <img
                        src={appointment.photo}
                        alt="Patient"
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base sm:text-lg truncate">{appointment.fullName}</h3>
                      <p className="text-xs sm:text-sm text-gray-500">{appointment.age} years, {appointment.gender}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                        <span className="text-xs sm:text-sm text-gray-600 truncate">{appointment.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Appointment Details */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{formatDate(appointment.appointmentDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{convertTo12Hour(appointment.timeSlot)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{appointment.doctor}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{appointment.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Priority and Condition */}
                  <div className="pt-3 space-y-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(appointment.priorityLevel)}`}>
                        <AlertCircle className="w-3 h-3" />
                        {appointment.priorityLevel}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Medical Condition:</p>
                      <p className="text-sm text-gray-600 line-clamp-2">{appointment.medicalCondition}</p>
                    </div>
                  </div>

                  {/* Action Buttons (Alternative for Mobile) */}
                  <div className="pt-3 border-t grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleView(appointment)}
                      className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Details</span>
                    </button>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {(appointment.status === 'pending' || appointment.status === 'scheduled') && (
                        <>
                          <button
                            onClick={() => handleReschedule(appointment)}
                            className="p-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition flex items-center justify-center"
                            title="Reschedule"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancel(appointment)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(appointment)}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination/Info Footer */}
        {filteredAppointments.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm sm:shadow-md p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold">{filteredAppointments.length}</span> appointment{filteredAppointments.length !== 1 ? 's' : ''}
                {searchQuery && ` for "${searchQuery}"`}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Sorted by:</span>
                <span className="font-semibold capitalize">{sortField.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-gray-400">({sortDirection})</span>
              </div>
            </div>
          </div>
        )}
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
          }}
        />
      )}

      {/* Staff Reschedule Modal */}
      {showRescheduleModal && selectedAppointment && (
        <StaffRescheduleModal
          isOpen={showRescheduleModal}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onConfirm={confirmReschedule}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Staff Cancel Modal */}
      {showStaffCancelModal && selectedAppointment && (
        <StaffCancel
          isOpen={showStaffCancelModal}
          onClose={() => {
            setShowStaffCancelModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onConfirm={confirmCancel}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAppointment && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6">
              <p className="text-gray-700 mb-4 sm:mb-6">
                Are you sure you want to delete this appointment? This action cannot be undone.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition order-1 sm:order-2"
                >
                  Delete Appointment
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