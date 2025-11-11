import { useState, useEffect } from 'react';
import { User, Mail, Phone, Stethoscope, Calendar } from 'lucide-react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

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

const OurDoctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDoctors();
    loadAppointments();
  }, []);

  const loadDoctors = async () => {
    setIsLoading(true);
    setError('');
    try {
      const doctorsRef = collection(db, 'doctors');
      let q = query(doctorsRef, orderBy('createdAt', 'desc'));
      
      try {
        q = query(doctorsRef, where('isActive', '==', true), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const doctorsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Doctor[];
        
        setDoctors(doctorsData);
        
        if (doctorsData.length === 0) {
          const allDoctorsQuery = query(doctorsRef, orderBy('createdAt', 'desc'));
          const allDoctorsSnapshot = await getDocs(allDoctorsQuery);
          const allDoctorsData = allDoctorsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Doctor[];
          
          setDoctors(allDoctorsData);
        }
        
      } catch (filterError) {
        const allDoctorsQuery = query(doctorsRef, orderBy('createdAt', 'desc'));
        const allDoctorsSnapshot = await getDocs(allDoctorsQuery);
        const allDoctorsData = allDoctorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Doctor[];
        
        setDoctors(allDoctorsData);
      }
      
    } catch (error) {
      console.error('Error loading doctors:', error);
      setError('Failed to load doctors. Please check your Firebase configuration.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadAppointments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('status', '==', 'confirmed'),
        where('date', '==', today)
      );
      const querySnapshot = await getDocs(q);
      
      const appointmentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];
      
      setAppointments(appointmentsData);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };

  const getDoctorAppointments = (doctorId: string) => {
    return appointments.filter(appointment => appointment.doctorId === doctorId);
  };

  const getDoctorSlotCount = (doctorId: string) => {
    const doctorAppointments = getDoctorAppointments(doctorId);
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
    const slotCount = getDoctorSlotCount(doctor.id);
    const totalSlots = getDoctorTotalSlots(doctor);
    const active = doctor.isActive === undefined ? true : doctor.isActive;
    
    return active && totalSlots > 0 && slotCount < totalSlots;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading our doctors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Medical Team</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Meet our team of highly qualified and experienced healthcare professionals 
            dedicated to providing you with the best medical care.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Doctors Grid */}
        {doctors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Doctors Found</h3>
            <p className="text-gray-500 mb-4">
              We couldn't find any doctors in the database. This could be because:
            </p>
            <ul className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-1">
              <li>• No doctors have been added to the database yet</li>
              <li>• The Firebase connection is not configured properly</li>
              <li>• The 'doctors' collection doesn't exist</li>
              <li>• All doctors are marked as inactive</li>
            </ul>
            <button
              onClick={loadDoctors}
              className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Retry Loading Doctors
            </button>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doctor) => {
              const slotCount = getDoctorSlotCount(doctor.id);
              const totalSlots = getDoctorTotalSlots(doctor);
              const available = isDoctorAvailable(doctor);

              return (
                <div key={doctor.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 relative">
                  {/* Availability Tag - Top Right */}
                  <div className={`absolute top-4 right-4 px-4 py-2 rounded-full text-sm font-semibold z-10 ${
                    available 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {available ? '✅ Available Today' : '❌ Unavailable Today'}
                  </div>

                  {/* Header with Gradient */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                    <div className="text-white text-center">
                      <p className="text-sm font-medium opacity-90">Specialist Doctor</p>
                      <p className="text-xl font-bold">Dr. {doctor.name.split(' ')[0]}</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Doctor Profile */}
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-4">
                        {doctor.photo ? (
                          <>
                            <img
                              src={doctor.photo}
                              alt={`Dr. ${doctor.name}`}
                              className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100"
                            />
                            {/* Availability Badge */}
                            <div className={`absolute -top-1 -right-1 w-7 h-7 rounded-full border-3 border-white ${
                              available ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          </>
                        ) : (
                          <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-indigo-100 border-4 border-indigo-100 flex items-center justify-center">
                              <User className="w-10 h-10 text-indigo-600" />
                            </div>
                            {/* Availability Badge */}
                            <div className={`absolute -top-1 -right-1 w-7 h-7 rounded-full border-3 border-white ${
                              available ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          </div>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-bold text-gray-900">Dr. {doctor.name}</h3>
                      <p className="text-indigo-600 font-semibold flex items-center gap-2 mt-1">
                        <Stethoscope className="w-4 h-4" />
                        {doctor.specialty}
                      </p>
                    </div>

                    {/* Slot Counter */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Today's Schedule</span>
                        </div>
                        <span className="font-bold text-indigo-600">
                          {slotCount} / {totalSlots}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${totalSlots > 0 ? (slotCount / totalSlots) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-3 text-gray-600">
                        <Mail className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm truncate">{doctor.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-600">
                        <Phone className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm">{doctor.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OurDoctors;