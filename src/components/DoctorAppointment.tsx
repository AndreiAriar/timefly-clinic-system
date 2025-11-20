import { useState, useEffect } from 'react';
import { Search, Filter, Clock, User } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

interface Appointment {
  id: string;
  fullName: string;
  age: string;
  photo: string;
  appointmentDate: string;
  gender: string;
  medicalCondition: string;
  phone: string;
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
  status: string;
}

interface DoctorAppointmentsProps {
  doctorName: string;
}

const DoctorAppointments = ({ doctorName }: DoctorAppointmentsProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
useEffect(() => {
    console.log('🔥 Setting up real-time listener for doctor appointments...');
    
    setIsLoading(true);
    
    const appointmentsRef = collection(db, 'appointments');
    const q = query(
      appointmentsRef,
      where('doctor', '==', doctorName),
      orderBy('appointmentDate', 'desc'),
      orderBy('timeSlot', 'asc')
    );
    
    // Real-time listener for appointments
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter out appointments deleted by staff or patient
        const appointmentsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Appointment))
          .filter(apt => !apt.deletedByStaff && !apt.deletedByPatient);
        
        console.log('📊 Real-time update - Doctor Appointments:', appointmentsData.length);
        setAppointments(appointmentsData);
        setFilteredAppointments(appointmentsData);
        setIsLoading(false);
      },
      (error) => {
        console.error('❌ Error in appointments listener:', error);
        setIsLoading(false);
      }
    );

    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up doctor appointments listener');
      unsubscribe();
    };
  }, [doctorName]);

  useEffect(() => {
    let filtered = appointments.filter(apt => 
      apt.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.medicalCondition.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }

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
      case 'completed': return 'bg-gray-100 text-gray-800';
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-600 mt-2">Manage your patient appointments and schedule</p>
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
                  <option value="completed">Completed</option>
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