import { useState, useEffect } from 'react';
import { User, Mail, Phone, Stethoscope, Calendar } from 'lucide-react';
import { collection, query, getDocs, onSnapshot, where, orderBy } from 'firebase/firestore';
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
        console.log('Filter query failed, loading all doctors:', filterError);
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
  };// Real-time appointments listener
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

 // ✅ FIXED: Match by doctor name, not ID
const getDoctorAppointments = (doctorName: string) => {
  const filtered = appointments.filter(appointment => 
    appointment.doctorId === doctorName || 
    appointment.doctorId === `Dr. ${doctorName}`
  );
  console.log(`📋 Appointments for ${doctorName}:`, filtered.length);
  return filtered;
};

 // ✅ FIXED: Pass doctor name instead of ID
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

// ✅ FIXED: Pass doctor name instead of ID
const isDoctorAvailable = (doctor: Doctor) => {
  const slotCount = getDoctorSlotCount(doctor.name);
  const totalSlots = getDoctorTotalSlots(doctor);
  const active = doctor.isActive === undefined ? true : doctor.isActive;
  
  console.log(`🔍 Doctor ${doctor.name} - Slots: ${slotCount}/${totalSlots}, Active: ${active}, Available: ${active && totalSlots > 0 && slotCount < totalSlots}`);
  
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
              const slotCount = getDoctorSlotCount(doctor.name);
              const totalSlots = getDoctorTotalSlots(doctor);
              const available = isDoctorAvailable(doctor);

              return (
                <div key={doctor.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 relative">
                  {/* Availability Tag - Top Right */}
                  <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold z-10 ${
                    available 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {available ? 'Available Today' : 'Unavailable Today'}
                  </div>

                  {/* Header */}
                  <div className="bg-blue-500 px-6 py-4">
                    <div className="text-white text-left">
                      <p className="text-sm font-medium opacity-90">Specialist Doctor</p>
                      <p className="text-xl font-bold">Dr. {doctor.name}</p>
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
                            <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                              available ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          </>
                        ) : (
                          <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-indigo-100 border-4 border-indigo-100 flex items-center justify-center">
                              <User className="w-10 h-10 text-indigo-600" />
                            </div>
                            {/* Availability Badge */}
                            <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
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
                    {/* ✅ UPDATED: Show "Fully Booked" when slots are full */}
                    {slotCount >= totalSlots && totalSlots > 0 ? (
                      <span className="font-bold text-red-600 px-2 py-1 bg-red-50 rounded-full text-xs border border-red-200">
                        Fully Booked
                      </span>
                    ) : (
                      <span className="font-bold text-indigo-600">
                        {slotCount} / {totalSlots}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        slotCount >= totalSlots && totalSlots > 0 ? 'bg-red-600' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${totalSlots > 0 ? Math.min((slotCount / totalSlots) * 100, 100) : 0}%` }}
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