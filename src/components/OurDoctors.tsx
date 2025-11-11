import { useState, useEffect } from 'react';
import { Search, Filter, User, Mail, Phone, Stethoscope, Star } from 'lucide-react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  photo: string;
  isActive: boolean;
  createdAt: string;
}

const OurDoctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
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
    let filtered = doctors.filter(doctor => doctor.isActive);

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doctor => 
        doctor.name.toLowerCase().includes(query) ||
        doctor.specialty.toLowerCase().includes(query)
      );
    }

    // Specialty filter
    if (specialtyFilter !== 'all') {
      filtered = filtered.filter(doctor => doctor.specialty === specialtyFilter);
    }

    setFilteredDoctors(filtered);
  }, [doctors, searchQuery, specialtyFilter]);

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
    } finally {
      setIsLoading(false);
    }
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
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Expert Doctors</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Meet our team of specialized eye care professionals dedicated to providing you with the best care
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-12 bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  placeholder="Search by name or specialty..."
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
          </div>

          {/* Active Filters Display */}
          {(searchQuery || specialtyFilter !== 'all') && (
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
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSpecialtyFilter('all');
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
              {searchQuery || specialtyFilter !== 'all'
                ? 'No doctors match your current filters.'
                : 'No doctors are currently available.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredDoctors.map((doctor) => (
              <div key={doctor.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                {/* Doctor Photo Section */}
                <div className="relative h-48 bg-gradient-to-br from-indigo-500 to-purple-600">
                  {doctor.photo ? (
                    <img
                      src={doctor.photo}
                      alt={`Dr. ${doctor.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-20 h-20 text-white opacity-80" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-semibold text-gray-700">5.0</span>
                  </div>
                </div>

                {/* Doctor Info Section */}
                <div className="p-6">
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Dr. {doctor.name}</h3>
                    <p className="text-indigo-600 font-semibold flex items-center justify-center gap-2">
                      <Stethoscope className="w-4 h-4" />
                      {doctor.specialty}
                    </p>
                  </div>

                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-indigo-500" />
                      <span className="truncate">{doctor.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-indigo-500" />
                      <span>{doctor.phone}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Experience</span>
                      <span className="font-semibold text-gray-700">5+ years</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-2">
                      <span className="text-gray-500">Patients</span>
                      <span className="font-semibold text-gray-700">1,000+</span>
                    </div>
                  </div>

                  <button className="w-full mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition transform hover:scale-105">
                    Book Appointment
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">Can't Find the Right Specialist?</h2>
            <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
              Our team will help you find the perfect doctor for your specific needs. Contact us for personalized assistance.
            </p>
            <button className="px-8 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-gray-100 transition">
              Contact Us Today
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OurDoctors;