import { useState, useEffect } from 'react';
import { Search, Clock, User } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase/config';

interface Appointment {
  id: string;
  fullName: string;
  age: string;
  photo: string;
  appointmentDate: string;
  doctor: string;
  gender: string;
  medicalCondition: string;
  phone: string;
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
  status: string;
  deletedByStaff?: boolean;
  deletedByPatient?: boolean;
}

interface DoctorAppointmentsProps {
  doctorName: string;
  isChristmasTheme?: boolean; 
}

const DoctorAppointments = ({ doctorName, isChristmasTheme = false }: DoctorAppointmentsProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Real-time listeners for both appointment collections
  // Real-time listeners for both appointment collections
  useEffect(() => {
    console.log('🔥 Setting up real-time listeners for doctor appointments...');
    console.log('Doctor Name:', doctorName);
    
    if (!doctorName) {
      console.warn('No doctor name provided');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // FIXED: Normalize doctor name for exact matching
    const normalizedDoctorName = doctorName.trim();
    
    const patientAppointmentsRef = collection(db, 'patient_appointments');
    const staffAppointmentsRef = collection(db, 'staff_appointments');
    
    const patientQuery = query(
      patientAppointmentsRef,
      where('doctor', '==', normalizedDoctorName), // Use normalized name
      orderBy('appointmentDate', 'desc')
    );
    
    const staffQuery = query(
      staffAppointmentsRef,
      where('doctor', '==', normalizedDoctorName), // Use normalized name
      orderBy('appointmentDate', 'desc')
    );

    let allAppointments: Appointment[] = [];
    const handleAppointmentsUpdate = (snapshot: QuerySnapshot<DocumentData>, source: string) => {
      const newAppointments = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: `${source}_${doc.id}`,
            originalId: doc.id,
            ...data
          } as Appointment & { originalId: string };
        })
        .filter((apt: Appointment) => {
          // CRITICAL: Filter by exact doctor match AND deletion flags
          const isDoctorMatch = apt.doctor.trim() === normalizedDoctorName;
          const isNotDeleted = !apt.deletedByStaff && !apt.deletedByPatient;
          return isDoctorMatch && isNotDeleted;
        });

      console.log(`📊 ${source} appointments for Dr. ${normalizedDoctorName}:`, newAppointments.length);

      // Update the combined appointments array by filtering out old appointments from this source
      allAppointments = allAppointments.filter(apt => !apt.id.startsWith(`${source}_`));
      allAppointments = [...allAppointments, ...newAppointments];

      // Deduplicate based on appointment details (same date, time, patient, doctor)
      const uniqueAppointments = allAppointments.reduce((acc, current) => {
        const key = `${current.appointmentDate}_${current.timeSlot}_${current.fullName}_${current.doctor.trim()}`;
        
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

      // Sort by date and time
      allAppointments.sort((a, b) => {
        const dateCompare = new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime();
        if (dateCompare !== 0) return dateCompare;
        
        const timeA = a.timeSlot || '00:00';
        const timeB = b.timeSlot || '00:00';
        return timeA.localeCompare(timeB);
      });
      
      console.log('📊 Combined Appointments (after deduplication):', allAppointments.length);
      setAppointments(allAppointments);
      setIsLoading(false);
    };
    // Real-time listener for patient appointments
    const unsubscribePatient = onSnapshot(
      patientQuery,
      (patientSnapshot) => {
        console.log('📊 Patient appointments update received');
        handleAppointmentsUpdate(patientSnapshot, 'patient');
      },
      (error) => {
        console.error('❌ Error in patient appointments listener:', error);
      }
    );

    // Real-time listener for staff appointments
    const unsubscribeStaff = onSnapshot(
      staffQuery,
      (staffSnapshot) => {
        console.log('📊 Staff appointments update received');
        handleAppointmentsUpdate(staffSnapshot, 'staff');
      },
      (error) => {
        console.error('❌ Error in staff appointments listener:', error);
      }
    );

    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up doctor appointments listeners');
      unsubscribePatient();
      unsubscribeStaff();
    };
  }, [doctorName]);

  // Filter appointments based on search and filters
  useEffect(() => {
    let filtered = [...appointments];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.fullName.toLowerCase().includes(query) ||
        apt.medicalCondition.toLowerCase().includes(query) ||
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
    if (!time24) return 'N/A';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

 return (
  <div className={`min-h-screen ${isChristmasTheme ? 'bg-gradient-to-br from-red-50 to-green-50' : 'bg-gray-50'} py-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-600 mt-2">
            Manage your patient appointments and schedule ({filteredAppointments.length} appointments)
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search patients or conditions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="w-full sm:w-48">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Priorities</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchQuery && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Search: "{searchQuery}"
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Status: {statusFilter}
                </span>
              )}
              {priorityFilter !== 'all' && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Priority: {priorityFilter}
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* List View */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Appointments Found</h3>
              <p className="text-gray-500">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'No appointments match your current filters.'
                  : 'No appointments scheduled.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAppointments.map((appointment) => (
                <div key={appointment.id} className="p-6 hover:bg-gray-50 transition">
                  {/* Mobile Layout (stacked) */}
                  <div className="lg:hidden flex flex-col space-y-4">
                    {/* Patient Info Row */}
                    <div className="flex items-center space-x-4">
                      {appointment.photo ? (
                        <img
                          src={appointment.photo}
                          alt="Patient"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{appointment.fullName}</h3>
                        <p className="text-sm text-gray-600">
                          {appointment.age} years • {appointment.gender}
                        </p>
                        <p className="text-sm text-gray-600">{appointment.medicalCondition}</p>
                      </div>
                    </div>

                    {/* Queue Number and Status Row */}
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-xs text-gray-900 font-medium mb-1">Queue</p>
                        <div className="text-blue-600 px-4 py-2 rounded-lg font-bold text-lg">
                          #{appointment.queueNumber}
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2">
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                            {appointment.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(appointment.priorityLevel)}`}>
                            {appointment.priorityLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Date and Time Row */}
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(appointment.appointmentDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{convertTo12Hour(appointment.timeSlot)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout (horizontal) */}
                  <div className="hidden lg:flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {appointment.photo ? (
                        <img
                          src={appointment.photo}
                          alt="Patient"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{appointment.fullName}</h3>
                        <p className="text-sm text-gray-600">
                          {appointment.age} years • {appointment.gender}
                        </p>
                        <p className="text-sm text-gray-600">{appointment.medicalCondition}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Queue Number Badge */}
                      <div className="text-center">
                        <p className="text-xs text-gray-900 font-medium mb-1">Queue</p>
                        <div className="text-blue-600 px-4 py-2 rounded-lg font-bold text-lg">
                          #{appointment.queueNumber}
                        </div>
                      </div>

                      {/* Date and Time Info */}
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-600 flex items-center justify-end gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(appointment.appointmentDate)}
                        </p>
                        <p className="text-sm text-gray-600 flex items-center justify-end gap-1 mt-1">
                          <Clock className="w-4 h-4" />
                          {convertTo12Hour(appointment.timeSlot)}
                        </p>
                        <div className="flex gap-2 mt-2 justify-end">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                            {appointment.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(appointment.priorityLevel)}`}>
                            {appointment.priorityLevel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorAppointments;