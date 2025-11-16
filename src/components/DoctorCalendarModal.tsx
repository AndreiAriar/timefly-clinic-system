import { X, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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

  useEffect(() => {
    if (isOpen) {
      loadDoctorAndAppointments();
    }
  }, [isOpen, doctorName, currentMonth]);

  const loadDoctorAndAppointments = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Loading doctor data for:', doctorName);
      
      // Load doctor data - try multiple name formats
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
        
        setDoctor(doctorData);

        // Load appointments for this doctor - use the exact name from the doctor document
        const appointmentsRef = collection(db, 'appointments');
        const appointmentsQuery = query(
          appointmentsRef,
          where('doctor', '==', doctorData.name)
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Appointment[];
        
        console.log('📅 Appointments loaded:', appointmentsData.length);
        setAppointments(appointmentsData);
      } else {
        console.log('❌ No doctor found with name:', doctorName);
        console.log('💡 Tried variations: exact match, with "Dr.", without "Dr."');
      }
    } catch (error) {
      console.error('❌ Error loading doctor calendar:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const getBookedSlotsForDate = (date: string): number => {
    const booked = appointments.filter(
      apt => apt.appointmentDate === date && apt.status !== 'cancelled'
    ).length;
    console.log(`📅 ${date}: Booked slots = ${booked}`);
    return booked;
  };

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

    // Get unavailable time slots marked by staff
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
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto border border-white/60">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/60">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Doctor Availability Calendar</h1>
            <p className="text-white/90 mt-2 drop-shadow-md">View your scheduled appointments and available slots</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition text-white drop-shadow-lg"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4 drop-shadow-lg"></div>
                <p className="text-white/90 drop-shadow-md">Loading calendar...</p>
              </div>
            </div>
          ) : !doctor ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-white/90 drop-shadow-md text-xl">Doctor not found</p>
              </div>
            </div>
          ) : (
            <>
              {/* Calendar View */}
              <div className="bg-transparent rounded-xl p-6">
                <div className="flex items-center justify-center mb-6">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="p-2 hover:bg-white/20 rounded-lg transition text-white drop-shadow-lg"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <h2 className="text-xl font-semibold text-white text-center min-w-[200px] drop-shadow-lg">
                      {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h2>
                    
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-2 hover:bg-white/20 rounded-lg transition text-white drop-shadow-lg"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                    <div key={day} className="p-1 text-center text-xs font-medium text-white/90 drop-shadow-md">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for proper day alignment */}
                  {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                    <div key={`empty-${index}`} className="min-h-[60px]" />
                  ))}
                  
                  {/* Current month days only */}
                  {generateCalendarDays().map((date) => {
                    const bookedSlots = getBookedSlotsForDate(date);
                    const totalSlots = getMaxSlotsForDate(date);
                    const isToday = date === new Date().toISOString().split('T')[0];
                    const isPast = new Date(date) < new Date(new Date().toISOString().split('T')[0]);

                    return (
                      <div
                        key={date}
                        className={`p-1.5 rounded-lg transition min-h-[60px] flex flex-col ${
                          isToday
                            ? 'border-2 border-white bg-white/10'
                            : 'border border-transparent'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-between flex-1">
                          <span className={`text-xs font-medium drop-shadow-md ${
                            isToday ? 'text-white font-bold' : isPast ? 'text-white/60' : 'text-white'
                          }`}>
                            {new Date(date).getDate()}
                          </span>
                          {!isPast && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full drop-shadow-sm ${
                              totalSlots === 0
                                ? 'bg-gray-500/30 text-white/80'
                                : bookedSlots >= totalSlots
                                ? 'bg-red-500/30 text-white'
                                : bookedSlots > 0
                                ? 'bg-green-500/30 text-white'
                                : 'bg-white/30 text-white'
                            }`}>
                              {totalSlots === 0 ? 'No slots' : `${bookedSlots}/${totalSlots}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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