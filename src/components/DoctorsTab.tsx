import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit2, Trash2, User, Mail, Phone, Stethoscope } from 'lucide-react';
import { collection, query, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
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
  createdAt: string;
  updatedAt: string;
}

const DoctorsTab = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleAddDoctor = () => {
    setSelectedDoctor(null);
    setShowDoctorModal(true);
  };

  const handleEditDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setShowDoctorModal(true);
  };

  const handleDeleteDoctor = async (doctor: Doctor) => {
    if (!confirm(`Are you sure you want to delete Dr. ${doctor.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'doctors', doctor.id));
      await loadDoctors();
      toast.success('Doctor deleted successfully!');
    } catch (error) {
      console.error('Error deleting doctor:', error);
      toast.error('Failed to delete doctor. Please try again.');
    }
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

            {/* Status Filter - Updated to Available/Unavailable */}
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
            {filteredDoctors.map((doctor) => (
              <div key={doctor.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
                  <div className="text-white">
                    <p className="text-sm font-medium">Doctor</p>
                    <p className="text-lg font-bold">Dr. {doctor.name.split(' ')[0]}</p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {doctor.photo ? (
                      <img
                        src={doctor.photo}
                        alt={`Dr. ${doctor.name}`}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                        <User className="w-8 h-8 text-indigo-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Dr. {doctor.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Stethoscope className="w-4 h-4" />
                        {doctor.specialty}
                      </p>
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

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <button
                      onClick={() => handleEditDoctor(doctor)}
                      className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDoctor(doctor)}
                      className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
    </div>
  );
};

export default DoctorsTab;