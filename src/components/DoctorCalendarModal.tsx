import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  photo: string;
  isActive: boolean;
  maxSlots: number;
  maxSlotsPerDate?: { [date: string]: number };
  availableSlots: { [date: string]: string[] };
  unavailableDates: { [date: string]: boolean };
  createdAt: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  status: string;
  doctor: string;
  timeSlot: string;
  source?: string;
}

interface DoctorCalendarModalProps {
  doctorName: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAppointments: () => void;
}

const DoctorCalendarModal = ({ doctorName, isOpen, onClose }: DoctorCalendarModalProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load doctor data initially
  const loadDoctor = useCallback(async (): Promise<Doctor | null> => {
    try {
      console.log('🔍 Loading doctor data for:', doctorName);
      
      const doctorsRef = collection(db, 'doctors');
      
      // First, try exact match
      let doctorQuery = query(doctorsRef, where('name', '==', doctorName));
      let doctorSnapshot = await getDocs(doctorQuery);
      
      // If not found, try with "Dr." prefix
      if (doctorSnapshot.empty && !doctorName.startsWith('Dr.')) {
        console.log('🔍 Trying with "Dr." prefix...');
        doctorQuery = query(doctorsRef, where('name', '==', `Dr. ${doctorName}`));
        doctorSnapshot = await getDocs(doctorQuery);
      }
      
      // If still not found, try without "Dr." prefix
      if (doctorSnapshot.empty && doctorName.startsWith('Dr.')) {
        console.log('🔍 Trying without "Dr." prefix...');
        const nameWithoutPrefix = doctorName.replace(/^Dr\.\s*/i, '');
        doctorQuery = query(doctorsRef, where('name', '==', nameWithoutPrefix));
        doctorSnapshot = await getDocs(doctorQuery);
      }

      if (!doctorSnapshot.empty) {
        const doctorDoc = doctorSnapshot.docs[0];
        const doctorData = {
          id: doctorDoc.id,
          ...doctorDoc.data()
        } as Doctor;
        
        console.log('✅ Doctor loaded:', doctorData);
        console.log('📊 maxSlots (global):', doctorData.maxSlots);
        console.log('📊 maxSlotsPerDate:', doctorData.maxSlotsPerDate);
        console.log('📊 unavailableDates:', doctorData.unavailableDates);
        console.log('📊 availableSlots (unavailable time slots):', doctorData.availableSlots);
        
        return doctorData;
      } else {
        console.log('❌ No doctor found with name:', doctorName);
        console.log('💡 Tried variations: exact match, with "Dr.", without "Dr."');
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading doctor:', error);
      return null;
    }
  }, [doctorName]);

  // Helper function to deduplicate appointments by timeSlot + appointmentDate
  const deduplicateAppointments = (appointmentsList: Appointment[]): Appointment[] => {
    const uniqueMap = new Map<string, Appointment>();
    
    appointmentsList.forEach(apt => {
      // Create a unique key based on doctor, date, and timeSlot
      const key = `${apt.doctor}_${apt.appointmentDate}_${apt.timeSlot}`;
      
      // Only add if not already in map (first one wins, or prefer patient_appointments)
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, apt);
      } else {
        // If duplicate exists, prefer the one from patient_appointments
        const existing = uniqueMap.get(key);
        if (existing?.source === 'staff' && apt.source === 'patient') {
          uniqueMap.set(key, apt);
        }
      }
    });
    
    const deduplicated = Array.from(uniqueMap.values());
    console.log(`🔄 Deduplicated: ${appointmentsList.length} -> ${deduplicated.length} appointments`);
    return deduplicated;
  };

  // Set up real-time listeners for appointments
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    
    let unsubscribeDoctor: Unsubscribe | null = null;
    let unsubscribePatientAppointments: Unsubscribe | null = null;
    let unsubscribeStaffAppointments: Unsubscribe | null = null;
    let currentDoctorName: string | null = null;
    
    // Store appointments from each source separately for merging
    let patientAppointmentsCache: Appointment[] = [];
    let staffAppointmentsCache: Appointment[] = [];

    const setupListeners = async () => {
      // First, load the doctor data
      const doctorData = await loadDoctor();
      
      if (!doctorData) {
        setDoctor(null);
        setAppointments([]);
        setIsLoading(false);
        return;
      }

      setDoctor(doctorData);
      currentDoctorName = doctorData.name;

      // Set up real-time listener for doctor data changes
      const doctorsRef = collection(db, 'doctors');
      const doctorQuery = query(doctorsRef, where('name', '==', currentDoctorName));
      
      unsubscribeDoctor = onSnapshot(doctorQuery, (snapshot) => {
        if (!snapshot.empty) {
          const updatedDoctor = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
          } as Doctor;
          console.log('🔄 Doctor data updated in real-time:', updatedDoctor.name);
          setDoctor(updatedDoctor);
        }
      }, (error) => {
        console.error('❌ Error listening to doctor changes:', error);
      });

      // Set up real-time listener for patient_appointments
      const patientAppointmentsRef = collection(db, 'patient_appointments');
      const patientQuery = query(
        patientAppointmentsRef,
        where('doctor', '==', currentDoctorName)
      );

      unsubscribePatientAppointments = onSnapshot(patientQuery, (snapshot) => {
        patientAppointmentsCache = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          source: 'patient'
        })) as Appointment[];
        
        console.log('🔄 Patient appointments updated:', patientAppointmentsCache.length);
        
        // Merge and deduplicate
        const combined = [...patientAppointmentsCache, ...staffAppointmentsCache];
        const deduplicated = deduplicateAppointments(combined);
        setAppointments(deduplicated);
      }, (error) => {
        console.error('❌ Error listening to patient appointments:', error);
      });

      // Set up real-time listener for staff_appointments
      const staffAppointmentsRef = collection(db, 'staff_appointments');
      const staffQuery = query(
        staffAppointmentsRef,
        where('doctor', '==', currentDoctorName)
      );

      unsubscribeStaffAppointments = onSnapshot(staffQuery, (snapshot) => {
        staffAppointmentsCache = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          source: 'staff'
        })) as Appointment[];
        
        console.log('🔄 Staff appointments updated:', staffAppointmentsCache.length);
        
        // Merge and deduplicate
        const combined = [...patientAppointmentsCache, ...staffAppointmentsCache];
        const deduplicated = deduplicateAppointments(combined);
        setAppointments(deduplicated);
      }, (error) => {
        console.error('❌ Error listening to staff appointments:', error);
      });

      setIsLoading(false);
    };

    setupListeners();

    // Cleanup function to unsubscribe from all listeners
    return () => {
      console.log('🧹 Cleaning up Firebase listeners...');
      if (unsubscribeDoctor) {
        unsubscribeDoctor();
      }
      if (unsubscribePatientAppointments) {
        unsubscribePatientAppointments();
      }
      if (unsubscribeStaffAppointments) {
        unsubscribeStaffAppointments();
      }
    };
  }, [isOpen, doctorName, loadDoctor]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const days: string[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateString = `${year}-${month}-${dayStr}`;
      days.push(dateString);
    }

    return days;
  };

  // Count booked slots (deduplicated)
  const getBookedSlotsForDate = (date: string): number => {
    const booked = appointments.filter(
      apt => apt.appointmentDate === date && 
             apt.status !== 'cancelled' &&
             apt.status !== 'completed' &&
             apt.status !== 'no-show'
    ).length;
    console.log(`📅 ${date}: Booked slots = ${booked}`);
    return booked;
  };

  // Calculate max available slots correctly
  const getMaxSlotsForDate = (date: string): number => {
    if (!doctor) {
      console.log(`❌ ${date}: No doctor data`);
      return 0;
    }

    console.log(`\n🔍 Calculating max slots for ${date}:`);

    // Check if doctor is completely unavailable for this date
    const unavailableDates = doctor.unavailableDates || {};
    if (unavailableDates[date]) {
      console.log(`   ⛔ Date is marked as unavailable`);
      return 0;
    }

    // Get max slots for this date (per-date override or global)
    const maxSlotsPerDate = doctor.maxSlotsPerDate || {};
    const dateSpecificSlots = maxSlotsPerDate[date];
    const globalSlots = doctor.maxSlots || 0;
    
    console.log(`   📊 maxSlotsPerDate['${date}']:`, dateSpecificSlots);
    console.log(`   📊 globalMaxSlots:`, globalSlots);

    // Use date-specific slots if set, otherwise use global
    const maxSlots = dateSpecificSlots !== undefined ? dateSpecificSlots : globalSlots;
    console.log(`   ✅ Using maxSlots: ${maxSlots} (${dateSpecificSlots !== undefined ? 'date-specific' : 'global'})`);

    // Get unavailable time slots marked by staff (these are specific time slots blocked)
    const unavailableTimeSlots = doctor.availableSlots?.[date] || [];
    console.log(`   ⛔ Unavailable time slots: ${unavailableTimeSlots.length}`);

    // Calculate available slots (max slots minus unavailable time slots)
    const availableSlots = Math.max(0, maxSlots - unavailableTimeSlots.length);
    console.log(`   ✨ Available slots: ${availableSlots} (${maxSlots} - ${unavailableTimeSlots.length})`);

    return availableSlots;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-white/80 backdrop-blur-sm rounded-t-xl">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Doctor Availability Calendar</h1>
            <p className="text-gray-600 mt-2">View your scheduled appointments and available slots</p>
            {doctor && (
              <p className="text-sm text-blue-600 mt-1">
                📡 Real-time updates enabled for {doctor.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600 ml-4 flex-shrink-0 md:relative absolute top-4 right-4 md:top-auto md:right-auto"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-transparent">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading calendar...</p>
              </div>
            </div>
          ) : !doctor ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-gray-600 text-xl">Doctor not found</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Stats - TOP */}
              <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                  <p className="text-2xl font-bold text-blue-700">{doctor.maxSlots || 0}</p>
                  <p className="text-sm text-blue-600">Default Daily Slots</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
                  <p className="text-2xl font-bold text-orange-700">
                    {appointments.filter(apt => 
                      apt.status === 'pending' || apt.status === 'confirmed' || apt.status === 'scheduled'
                    ).length}
                  </p>
                  <p className="text-sm text-orange-600">Active Appointments</p>
                </div>
                <div className="bg-gray-100 rounded-lg p-4 text-center border border-gray-300">
                  <p className="text-2xl font-bold text-gray-700">
                    {Object.keys(doctor.unavailableDates || {}).filter(date => doctor.unavailableDates?.[date]).length}
                  </p>
                  <p className="text-sm text-gray-600">Blocked Dates</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                  <p className="text-2xl font-bold text-green-700">
                    {appointments.filter(apt => apt.status === 'completed').length}
                  </p>
                  <p className="text-sm text-green-600">Completed</p>
                </div>
              </div>

              {/* Calendar View */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-center mb-6">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-700 border border-gray-300"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <h2 className="text-xl font-semibold text-gray-900 text-center min-w-[200px]">
                      {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h2>
                    
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-700 border border-gray-300"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-700 bg-gray-100/80 backdrop-blur-sm rounded-lg">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {/* Empty cells for proper day alignment */}
                  {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                    <div key={`empty-${index}`} className="min-h-[80px]" />
                  ))}
                  
                  {/* Current month days only */}
                  {generateCalendarDays().map((date) => {
                    const bookedSlots = getBookedSlotsForDate(date);
                    const totalSlots = getMaxSlotsForDate(date);
                    const remainingSlots = Math.max(0, totalSlots - bookedSlots);
                    const isToday = date === new Date().toISOString().split('T')[0];
                    const isPast = new Date(date) < new Date(new Date().toISOString().split('T')[0]);

                    return (
                      <div
                        key={date}
                        className={`p-2 rounded-lg border min-h-[80px] flex flex-col backdrop-blur-sm ${
                          isToday
                            ? 'border-2 border-blue-500 bg-blue-100/80'
                            : 'border-gray-200 bg-white/90'
                        } ${isPast ? 'opacity-60' : ''}`}
                      >
                        <div className="flex flex-col items-center justify-between flex-1">
                          <span className={`text-sm font-medium ${
                            isToday ? 'text-blue-700 font-bold' : 'text-gray-700'
                          }`}>
                            {new Date(date + 'T00:00:00').getDate()}
                          </span>
                          {!isPast && (
                            <>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm ${
                                totalSlots === 0
                                  ? 'bg-gray-200/80 text-gray-600'
                                  : bookedSlots >= totalSlots
                                  ? 'bg-red-100/80 text-red-700'
                                  : bookedSlots > 0
                                  ? 'bg-green-100/80 text-green-700'
                                  : 'bg-blue-100/80 text-blue-700'
                              }`}>
                                {totalSlots === 0 ? 'No slots' : `${bookedSlots}/${totalSlots}`}
                              </span>
                              {totalSlots > 0 && remainingSlots > 0 && (
                                <span className="text-xs text-gray-500 mt-1">
                                  {remainingSlots} left
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend - BOTTOM */}
              <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 border border-blue-300"></span>
                  <span className="text-gray-600">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-100 border border-green-300"></span>
                  <span className="text-gray-600">Partially Booked</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-100 border border-red-300"></span>
                  <span className="text-gray-600">Fully Booked</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-gray-200 border border-gray-300"></span>
                  <span className="text-gray-600">Unavailable</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorCalendarModal;