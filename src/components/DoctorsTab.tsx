import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit2, Trash2, User, Mail, Phone, Stethoscope, Calendar, X } from 'lucide-react';
import { collection, query, getDocs, onSnapshot, deleteDoc, doc, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import DoctorModal from './DoctorModal';
import { toast } from 'react-toastify';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  photo: string;
  isActive: boolean;
  maxSlots?: number;
  maxSlotsPerDate?: { [date: string]: number };
  availableSlots?: { [date: string]: string[] };
  unavailableDates?: { [date: string]: boolean };
  createdAt: string;
  updatedAt: string;
}

interface Appointment {
  id: string;
  doctorId: string;
  status: string;
  date: string;
  time: string;
}

const DoctorsTab = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);

  const specialties = [
    'Ophthalmology',
    'Optometry',
    'Retina Specialist',
    'Cornea Specialist',
    'Glaucoma Specialist',
    'Pediatric Ophthalmology',
    'Oculoplastics',
    'Neuro-ophthalmology'
  ];

  useEffect(() => {
  loadDoctors();
}, []);

  useEffect(() => {
    let filtered = [...doctors];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doctor => 
        doctor.name.toLowerCase().includes(query) ||
        doctor.specialty.toLowerCase().includes(query) ||
        doctor.email.toLowerCase().includes(query) ||
        doctor.phone.includes(query)
      );
    }

    // Specialty filter
    if (specialtyFilter !== 'all') {
      filtered = filtered.filter(doctor => doctor.specialty === specialtyFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'available';
      filtered = filtered.filter(doctor => doctor.isActive === isActive);
    }

    setFilteredDoctors(filtered);
  }, [doctors, searchQuery, specialtyFilter, statusFilter]);

  const loadDoctors = async () => {
    setIsLoading(true);
    try {
      const doctorsRef = collection(db, 'doctors');
      const q = query(doctorsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const doctorsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Doctor[];
      
      setDoctors(doctorsData);
    } catch (error) {
      console.error('Error loading doctors:', error);
      toast.error('Failed to load doctors. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
// Real-time appointments listener
useEffect(() => {
  const today = new Date();
  const phTime = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const year = phTime.getFullYear();
  const month = String(phTime.getMonth() + 1).padStart(2, '0');
  const day = String(phTime.getDate()).padStart(2, '0');
  const todayPH = `${year}-${month}-${day}`;
  
  const appointmentsRef = collection(db, 'appointments');
  const q = query(
    appointmentsRef,
    where('appointmentDate', '==', todayPH)
  );
  
  // Subscribe to real-time updates
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const appointmentsData = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            doctorId: data.doctor || '',
            status: data.status,
            date: data.appointmentDate,
            time: data.timeSlot
          };
        })
        .filter(apt => 
          apt.status !== 'cancelled' && 
          apt.status !== 'completed' && 
          apt.status !== 'missed'
        ) as Appointment[];
      
      console.log('📊 Real-time appointments update:', appointmentsData.length);
      setAppointments(appointmentsData);
    },
    (error) => {
      console.error('Error listening to appointments:', error);
    }
  );
  
  return () => unsubscribe();
}, []);

 const getDoctorAppointments = (doctorName: string) => {
  const filtered = appointments.filter(appointment => 
    appointment.doctorId === doctorName || 
    appointment.doctorId === `Dr. ${doctorName}`
  );
  return filtered;
};

const getDoctorSlotCount = (doctorName: string) => {
  const doctorAppointments = getDoctorAppointments(doctorName);
  return doctorAppointments.length;
};

  const getDoctorTotalSlots = (doctor: Doctor) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if doctor is completely unavailable today
    if (doctor.unavailableDates?.[today]) {
      return 0;
    }
    
    // Get date-specific max slots or fallback to global maxSlots
    const dateSpecificSlots = doctor.maxSlotsPerDate?.[today];
    const globalSlots = doctor.maxSlots || 8;
    const maxSlots = dateSpecificSlots !== undefined ? dateSpecificSlots : globalSlots;
    
    // Subtract unavailable time slots
    const unavailableTimeSlots = doctor.availableSlots?.[today] || [];
    const availableSlots = Math.max(0, maxSlots - unavailableTimeSlots.length);
    
    return availableSlots;
  };

const isDoctorAvailable = (doctor: Doctor) => {
  const slotCount = getDoctorSlotCount(doctor.name);
  const totalSlots = getDoctorTotalSlots(doctor);
  const active = doctor.isActive === undefined ? true : doctor.isActive;
  
  return active && totalSlots > 0 && slotCount < totalSlots;
};

  const handleAddDoctor = () => {
    setSelectedDoctor(null);
    setShowDoctorModal(true);
  };

  const handleEditDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setShowDoctorModal(true);
  };

  const handleDeleteDoctor = (doctor: Doctor) => {
    setDoctorToDelete(doctor);
    setShowDeleteModal(true);
  };

  const confirmDeleteDoctor = async () => {
    if (!doctorToDelete) return;

    try {
      await deleteDoc(doc(db, 'doctors', doctorToDelete.id));
      await loadDoctors();
      toast.success('Doctor deleted successfully!');
      setShowDeleteModal(false);
      setDoctorToDelete(null);
    } catch (error) {
      console.error('Error deleting doctor:', error);
      toast.error('Failed to delete doctor. Please try again.');
    }
  };

  const cancelDeleteDoctor = () => {
    setShowDeleteModal(false);
    setDoctorToDelete(null);
  };

  const handleDoctorModalClose = () => {
    setShowDoctorModal(false);
    setSelectedDoctor(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading doctors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Doctors Management</h1>
            <p className="text-gray-600 mt-2">Manage hospital doctors and their specialties</p>
          </div>
          <button
            onClick={handleAddDoctor}
            className="mt-4 sm:mt-0 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add New Doctor
          </button>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Doctors
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="search"
                  placeholder="Search by name, specialty, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Specialty Filter */}
            <div>
              <label htmlFor="specialtyFilter" className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Specialty
              </label>
              <select
                id="specialtyFilter"
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Specialties</option>
                {specialties.map(specialty => (
                  <option key={specialty} value={specialty}>{specialty}</option>
                ))}
              </select>
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
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || specialtyFilter !== 'all' || statusFilter !== 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchQuery && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  Search: "{searchQuery}"
                </span>
              )}
              {specialtyFilter !== 'all' && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  Specialty: {specialtyFilter}
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  Status: {statusFilter}
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSpecialtyFilter('all');
                  setStatusFilter('all');
                }}
                className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Doctors Grid */}
        {filteredDoctors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Doctors Found</h3>
            <p className="text-gray-500">
              {searchQuery || specialtyFilter !== 'all' || statusFilter !== 'all'
                ? 'No doctors match your current filters.'
                : 'No doctors have been added yet.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDoctors.map((doctor) => {
              const slotCount = getDoctorSlotCount(doctor.name);
              const totalSlots = getDoctorTotalSlots(doctor);
              const available = isDoctorAvailable(doctor);

              return (
                <div key={doctor.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition relative">
                  {/* Availability Tag - Top Right */}
                  <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium z-10 ${
                    available 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {available ? 'Available' : 'Unavailable'}
                  </div>
                    <div className="bg-blue-500 px-4 py-3">
                    <div className="text-white">
                      <p className="text-sm font-medium">Doctor</p>
                      <p className="text-lg font-bold">Dr. {doctor.name.split(' ')[0]}</p>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        {doctor.photo ? (
                          <>
                            <img
                              src={doctor.photo}
                              alt={`Dr. ${doctor.name}`}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                            {/* Availability Badge */}
                            <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                              available ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          </>
                        ) : (
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                              <User className="w-8 h-8 text-indigo-600" />
                            </div>
                            {/* Availability Badge */}
                            <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                              available ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">Dr. {doctor.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Stethoscope className="w-4 h-4" />
                          {doctor.specialty}
                        </p>
                      </div>
                    </div>

                    {/* Slot Counter */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Today's Appointments</span>
                        </div>
                        <span className="font-semibold text-indigo-600">
                          {slotCount} / {totalSlots}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${totalSlots > 0 ? (slotCount / totalSlots) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{doctor.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{doctor.phone}</span>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs text-gray-500">
                        {doctor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  {/* Action Buttons */}
                  <div className="flex justify-center items-center gap-4 pt-3">
                    <button
                      onClick={() => handleEditDoctor(doctor)}
                      className="px-4 py-2 text-gray-700 rounded-lg transition flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDoctor(doctor)}
                      className="px-4 py-2 text-gray-700 rounded-lg transition flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Doctor Modal */}
      <DoctorModal
        isOpen={showDoctorModal}
        onClose={handleDoctorModalClose}
        onDoctorAdded={loadDoctors}
        editDoctor={selectedDoctor}
      />

      {/* Delete Confirmation Modal */}
        {showDeleteModal && doctorToDelete && (
        <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="flex items-center justify-center min-h-screen px-4 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 backdrop-blur-sm transition-opacity"
              onClick={cancelDeleteDoctor}
              aria-hidden="true"
            ></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-[101]">
              {/* Modal content remains exactly the same here */}
              <div className="bg-white px-6 py-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 id="delete-modal-title" className="text-2xl font-bold text-gray-900">
                    Confirm Deletion
                  </h3>
                  <button
                    onClick={cancelDeleteDoctor}
                    className="text-gray-400 hover:text-gray-600 transition"
                    aria-label="Close modal"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-gray-700 mb-4">
                    Are you sure you want to delete <strong>Dr. {doctorToDelete.name}</strong>? This action cannot be undone.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 text-sm font-medium">
                      ⚠️ Warning: This will permanently remove the doctor and all associated data.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={cancelDeleteDoctor}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteDoctor}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                  >
                    Delete Doctor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorsTab;