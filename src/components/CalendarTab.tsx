import { X, Save, Clock, User, Calendar, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

// ============= Interfaces =============
interface Doctor {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  photo: string;
  isActive: boolean;
  maxSlots: number; // Global default max slots
  maxSlotsPerDate?: { [date: string]: number }; // Per-date max slots override
  availableSlots: { [date: string]: string[] }; // Stores UNAVAILABLE time slots per date
  unavailableDates: { [date: string]: boolean }; // Dates when doctor is completely unavailable
  createdAt: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  status: string;
  doctor: string;
  // Add other appointment properties as needed
}

interface ManageDoctorAvailabilityProps {
  date: string;
  doctor: Doctor;
  onClose: () => void;
  onUpdate: () => void;
  onBackToDoctors: () => void;
}

interface SelectedDateInfo {
  date: string;
  doctor: Doctor;
}

// ============= ManageDoctorAvailability Component =============
const ManageDoctorAvailability = ({ date, doctor, onClose, onUpdate, onBackToDoctors }: ManageDoctorAvailabilityProps) => {
  const [maxSlots, setMaxSlots] = useState<number | string>(doctor.maxSlots || 10);
  const [isAvailableForDate, setIsAvailableForDate] = useState(true);
  const [unavailableSlots, setUnavailableSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const formatTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    for (let hour = 8; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    // Load doctor-specific data for this date
    const unavailableDates = doctor.unavailableDates || {};
    setIsAvailableForDate(!unavailableDates[date]);
    
    // Load unavailable slots for this date (inverted logic)
    setUnavailableSlots(doctor.availableSlots?.[date] || []);
  }, [date, doctor]);

  const toggleTimeSlot = (timeSlot: string): void => {
    setUnavailableSlots(prev => {
      if (prev.includes(timeSlot)) {
        // Remove from unavailable (make it available)
        return prev.filter(slot => slot !== timeSlot);
      } else {
        // Add to unavailable
        return [...prev, timeSlot];
      }
    });
  };

const handleSave = async (): Promise<void> => {
  // Convert maxSlots to number for comparison
  const maxSlotsNumber = typeof maxSlots === 'string' ? parseInt(maxSlots) || 0 : maxSlots;
  
if (maxSlotsNumber < 1) {
  toast.error('Please enter a valid number of slots (minimum 1)');
  return;
}
  setIsLoading(true);
  try {
    // Update doctor in Firestore
    const doctorRef = doc(db, 'doctors', doctor.id);
    
    // ✅ Handle unavailable dates
    const unavailableDates = { ...doctor.unavailableDates };
    if (!isAvailableForDate) {
      unavailableDates[date] = true;
    } else {
      delete unavailableDates[date];
    }

    // ✅ Handle unavailable time slots
    const availableSlots = { ...doctor.availableSlots };
    availableSlots[date] = unavailableSlots;

    // ✅ FIX: Store per-date max slots properly
    const maxSlotsPerDate = { ...(doctor.maxSlotsPerDate || {}) };
    maxSlotsPerDate[date] = maxSlotsNumber;

    // ✅ Update only per-date configuration (does NOT affect global maxSlots)
    await updateDoc(doctorRef, {
      maxSlotsPerDate,  // ✅ Per-date max slots
      unavailableDates,
      availableSlots,
      updatedAt: new Date().toISOString()
    });

   toast.success(`Doctor availability updated successfully for ${formatDate(date)}`, {
      autoClose: 3000,
      position: "top-right"
    });
    onUpdate();
    onClose();
  } catch (error) {
  console.error('Error updating doctor availability:', error);
  toast.error('Failed to update doctor availability');
  }
  finally {
    setIsLoading(false);
  }
};

  const formatDate = (dateString: string): string => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleMaxSlotsChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    // Only allow numbers
    if (/^\d*$/.test(value)) {
      setMaxSlots(value === '' ? '' : parseInt(value));
    }
  };

  return (
    <div className="fixed inset-0 bg-white bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Manage Doctor Availability</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition text-white hover:text-gray-200"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Selected Date */}
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 text-indigo-700">
              <Calendar className="w-5 h-5" />
              <span className="font-semibold">Selected Date:</span>
              <span>{formatDate(date)}</span>
            </div>
          </div>

          {/* Doctor Information */}
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center gap-4">
              {doctor.photo ? (
                <img
                  src={doctor.photo}
                  alt={`Dr. ${doctor.name}`}
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200">
                  <User className="w-8 h-8 text-indigo-600" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Dr. {doctor.name}</h3>
                <p className="text-gray-600">{doctor.specialty}</p>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Email:</span>
                    <span className="text-sm font-medium">{doctor.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Phone:</span>
                    <span className="text-sm font-medium">{doctor.phone}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Availability Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Max Slots Input */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" />
                  Max Slots for this Day:
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxSlots}
                  onChange={handleMaxSlotsChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent no-spinner"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Total number of appointment slots available for this day
              </p>
            </div>
            {/* Availability Toggle */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Doctor Availability:
              </label>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-300">
                <span className={`font-medium ${isAvailableForDate ? 'text-green-600' : 'text-red-600'}`}>
                  {isAvailableForDate ? 'Available' : 'Unavailable'}
                </span>
                <button
                  onClick={() => setIsAvailableForDate(!isAvailableForDate)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    isAvailableForDate ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  aria-label={isAvailableForDate ? 'Mark as unavailable' : 'Mark as available'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isAvailableForDate ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {isAvailableForDate 
                  ? 'Doctor is available for appointments on this day'
                  : 'Doctor is not available for appointments on this day'
                }
              </p>
            </div>
          </div>

          {/* Time Slots Grid */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Time Slots Management</h3>
              <p className="text-sm text-gray-600 mt-1">
                Click on time slots to mark them as unavailable. Unavailable slots will be shown in red and cannot be booked.
              </p>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {timeSlots.map((timeSlot) => {
                  const isSlotUnavailable = unavailableSlots.includes(timeSlot);
                  
                  return (
                    <button
                      key={timeSlot}
                      onClick={() => toggleTimeSlot(timeSlot)}
                      className={`p-3 rounded-lg text-sm font-medium transition-all border-2 ${
                        isSlotUnavailable
                          ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
                      }`}
                      title={isSlotUnavailable ? 'Mark as available' : 'Mark as unavailable'}
                    >
                      <div className="text-center">
                        <div className="font-semibold">{formatTo12Hour(timeSlot)}</div>
                        {isSlotUnavailable && (
                          <div className="text-xs mt-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Unavailable
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onBackToDoctors}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition font-medium flex items-center gap-2"
            disabled={isLoading}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Doctors
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CalendarTab = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateInfo, setSelectedDateInfo] = useState<SelectedDateInfo | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showDoctorSelector, setShowDoctorSelector] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load doctors and appointments from Firestore
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        setIsLoading(true);
        
        // Load doctors
        const doctorsRef = collection(db, 'doctors');
        const doctorsSnapshot = await getDocs(doctorsRef);
        const doctorsData = doctorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Doctor[];
        setDoctors(doctorsData);
        
        // Load appointments
        const appointmentsRef = collection(db, 'appointments');
        const appointmentsSnapshot = await getDocs(appointmentsRef);
        const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Appointment[];
        setAppointments(appointmentsData);
        
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const getBookedSlotsForDate = (date: string): number => {
    return appointments.filter(
      (apt: Appointment) => apt.appointmentDate === date && apt.status !== 'cancelled'
    ).length;
  };

  const getTotalSlotsForDate = (date: string): number => {
    console.log(`\n📅 === Calculating total slots for ${date} ===`);
    
    const total = doctors.reduce((total: number, doctor: Doctor) => {
      console.log(`\n👨‍⚕️ Doctor: ${doctor.name} (ID: ${doctor.id})`);
      console.log(`   isActive: ${doctor.isActive}`);
      
      // Skip inactive doctors
      if (!doctor.isActive) {
        console.log(`   ⏭️  Skipped (inactive)`);
        return total;
      }
      
      // Skip if doctor is marked unavailable for this specific date
      const unavailableDates = doctor.unavailableDates || {};
      if (unavailableDates[date]) {
        console.log(`   ⏭️  Skipped (unavailable on ${date})`);
        return total;
      }
      
      // ✅ FIXED: Always use per-date maxSlots, fallback to global only if not set
      const maxSlotsPerDate = doctor.maxSlotsPerDate || {};
      const dateSpecificSlots = maxSlotsPerDate[date];
      const globalSlots = doctor.maxSlots || 0;
      
      console.log(`   📊 maxSlotsPerDate object:`, doctor.maxSlotsPerDate);
      console.log(`   📊 maxSlotsPerDate['${date}']: ${dateSpecificSlots}`);
      console.log(`   📊 globalMaxSlots: ${globalSlots}`);
      
      // ✅ Use date-specific slots if set, otherwise use global
      const maxSlots = dateSpecificSlots !== undefined ? dateSpecificSlots : globalSlots;
      console.log(`   ✅ Using maxSlots: ${maxSlots} (${dateSpecificSlots !== undefined ? 'date-specific' : 'global'})`);
      
      // Get unavailable time slots for this specific date
      const unavailableTimeSlots = doctor.availableSlots?.[date] || [];
      console.log(`   ⛔ Unavailable time slots: ${unavailableTimeSlots.length}`);
      
      // Calculate available slots (total slots minus unavailable time slots)
      const availableSlotsCount = Math.max(0, maxSlots - unavailableTimeSlots.length);
      console.log(`   ✨ Available slots: ${availableSlotsCount} (${maxSlots} - ${unavailableTimeSlots.length})`);
      console.log(`   🔢 Running total: ${total} + ${availableSlotsCount} = ${total + availableSlotsCount}`);
      
      return total + availableSlotsCount;
    }, 0);
    
    console.log(`\n🎯 === TOTAL SLOTS FOR ${date}: ${total} ===\n`);
    return total;
  };
  
  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = (): string[] => {
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

  const handleDateClick = (date: string): void => {
    const isPast = new Date(date) < new Date(new Date().toISOString().split('T')[0]);
    if (isPast || doctors.length === 0) return;
    
    setSelectedDate(date);
    setShowDoctorSelector(true);
  };

  const handleDoctorSelect = (doctor: Doctor): void => {
    setSelectedDateInfo({ date: selectedDate!, doctor });
    setShowDoctorSelector(false);
    setShowManageModal(true);
  };

  const handleCloseModal = (): void => {
    setShowManageModal(false);
    setSelectedDateInfo(null);
  };

  const handleCloseDoctorSelector = (): void => {
    setShowDoctorSelector(false);
    setSelectedDate(null);
  };

  const handleBackToDoctors = (): void => {
    setShowManageModal(false);
    setShowDoctorSelector(true);
  };

  const handleAvailabilityUpdate = async (): Promise<void> => {
    console.log('🔄 Reloading doctors after availability update...');
    
    try {
      // Reload doctors data
      const doctorsRef = collection(db, 'doctors');
      const querySnapshot = await getDocs(doctorsRef);
      
      const doctorsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`📋 Doctor ${data.name} (${doc.id}):`);
        console.log('  - maxSlots (global):', data.maxSlots);
        console.log('  - maxSlotsPerDate:', data.maxSlotsPerDate);
        console.log('  - availableSlots:', data.availableSlots);
        console.log('  - unavailableDates:', data.unavailableDates);
        console.log('  - isActive:', data.isActive);
        
        return {
          id: doc.id,
          name: data.name,
          specialty: data.specialty,
          email: data.email,
          phone: data.phone,
          photo: data.photo,
          isActive: data.isActive,
          maxSlots: data.maxSlots,
          maxSlotsPerDate: data.maxSlotsPerDate || {},
          availableSlots: data.availableSlots || {},
          unavailableDates: data.unavailableDates || {},
          createdAt: data.createdAt
        };
      }) as Doctor[];
      
      console.log(`✅ Loaded ${doctorsData.length} doctors`);
      setDoctors(doctorsData);
      
      // Force a re-render by updating state
      setCurrentMonth(new Date(currentMonth));
      
    } catch (error) {
      console.error('❌ Error reloading doctors:', error);
      toast.error('Failed to reload doctor data');
    }
  };

  const navigateMonth = (direction: 'prev' | 'next'): void => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Doctor Availability Calendar</h1>
              <p className="text-gray-600 mt-2">Click on any date to select a doctor and manage their availability</p>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              
              <h2 className="text-xl font-semibold text-gray-800 text-center min-w-[200px]">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
              <div key={day} className="p-1 text-center text-xs font-medium text-gray-600 bg-gray-50">
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
              const totalSlots = getTotalSlotsForDate(date);
              const isToday = date === new Date().toISOString().split('T')[0];
              const isPast = new Date(date) < new Date(new Date().toISOString().split('T')[0]);

              return (
                <div
                  key={date}
                  className={`p-1.5 rounded-lg border transition cursor-pointer min-h-[60px] flex flex-col ${
                    isToday
                      ? 'border-indigo-500 bg-indigo-50'
                      : isPast
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                  }`}
                  onClick={() => handleDateClick(date)}
                >
                  <div className="flex flex-col items-center justify-between flex-1">
                    <span className={`text-xs font-medium ${
                      isToday ? 'text-indigo-700' : isPast ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      {new Date(date).getDate()}
                    </span>
                    {!isPast && (
                      <span className={`text-[10px] px-1 py-0.5 rounded-full ${
                        bookedSlots === totalSlots
                          ? 'bg-red-100 text-red-800'
                          : bookedSlots > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {bookedSlots}/{totalSlots}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {doctors.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center mt-6">
            <div className="w-16 h-16 text-gray-400 mx-auto mb-4 flex items-center justify-center">
              <User className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Doctors Found</h3>
            <p className="text-gray-500">Add doctors to manage their availability.</p>
          </div>
        )}
      </div>

      {/* Doctor Selector Modal */}
      {showDoctorSelector && selectedDate && (
        <div className="fixed inset-0 bg-white bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full border border-gray-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
              <div>
                <h2 className="text-xl font-bold text-white">Select Doctor</h2>
                <p className="text-sm text-indigo-100 mt-1">
                  Choose a doctor to manage availability for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={handleCloseDoctorSelector}
                className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition text-white hover:text-gray-200"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-4">
                {doctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    onClick={() => handleDoctorSelect(doctor)}
                    className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition text-left w-full"
                  >
                    {doctor.photo ? (
                      <img
                        src={doctor.photo}
                        alt={`Dr. ${doctor.name}`}
                        className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200">
                        <User className="w-8 h-8 text-indigo-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">Dr. {doctor.name}</h3>
                      <p className="text-sm text-gray-600">{doctor.specialty}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500">{doctor.email}</span>
                        <span className="text-xs text-gray-500">{doctor.phone}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Doctor Availability Modal */}
      {showManageModal && selectedDateInfo && (
        <ManageDoctorAvailability
          date={selectedDateInfo.date}
          doctor={selectedDateInfo.doctor}
          onClose={handleCloseModal}
          onUpdate={handleAvailabilityUpdate}
          onBackToDoctors={handleBackToDoctors}
        />
      )}
    </div>
  );
};

export default CalendarTab;