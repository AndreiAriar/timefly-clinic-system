import { useState, useEffect } from 'react';
import { X, Calendar, ChevronLeft, ChevronRight, User, Clock, ArrowLeft } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';
import AppointmentModal from './AppointmentModal'; // Keep this import

// ============= Interfaces =============
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
  unavailableDates?: { [date: string]: boolean };
  createdAt: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  timeSlot: string;  // ✅ FIXED: Changed from appointmentTime to timeSlot
  status: string;
  doctor: string;  // This is the doctor's name
  gender: string;
  medicalCondition: string;
  phone: string;
  priorityLevel: string;
  queueNumber: number;
  createdAt: string;
  fullName: string;
  age: string;
  photo?: string;
}

interface CalendarWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingComplete?: () => void;
}

// ============= Main Component =============
const CalendarWizardModal = ({ isOpen, onClose, onBookingComplete }: CalendarWizardModalProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);

  // Load doctors and appointments
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const doctorsRef = collection(db, 'doctors');
      const doctorsSnapshot = await getDocs(doctorsRef);
      const doctorsData = doctorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Doctor[];
      setDoctors(doctorsData.filter(d => d.isActive));

      const appointmentsRef = collection(db, 'appointments');
      const appointmentsSnapshot = await getDocs(appointmentsRef);
      const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];
      setAppointments(appointmentsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  };

  // ============= Helper Functions =============
  const formatDate = (dateString: string): string => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  const now = new Date();
  
  if (!selectedDate) return [];
  
  const [year, month, day] = selectedDate.split('-').map(Number);
  
  for (let hour = 8; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Skip lunch time (12:00 PM - 1:00 PM)
      if (hour === 12) continue;
      
      const appointmentDateTime = new Date(year, month - 1, day, hour, minute);
      const bufferTime = new Date(now.getTime() + 30 * 60 * 1000);
      
      if (appointmentDateTime > bufferTime) {
        slots.push(timeString);
      }
    }
  }
  return slots;
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
      days.push(`${year}-${month}-${dayStr}`);
    }
    return days;
  };

  const getBookedSlotsForDate = (date: string): number => {
    return appointments.filter(
      apt => apt.appointmentDate === date && apt.status !== 'cancelled'
    ).length;
  };

  const getTotalSlotsForDate = (date: string): number => {
    return doctors.reduce((total, doctor) => {
      if (!doctor.isActive) return total;
      if (doctor.unavailableDates?.[date]) return total;
      
      const maxSlotsPerDate = doctor.maxSlotsPerDate || {};
      const dateSpecificSlots = maxSlotsPerDate[date];
      const globalSlots = doctor.maxSlots || 0;
      const maxSlots = dateSpecificSlots !== undefined ? dateSpecificSlots : globalSlots;
      
      const unavailableTimeSlots = doctor.availableSlots?.[date] || [];
      const availableSlotsCount = Math.max(0, maxSlots - unavailableTimeSlots.length);
      
      return total + availableSlotsCount;
    }, 0);
  };

  const getAvailableSlotsForDoctor = (doctor: Doctor, date: string): number => {
    if (doctor.unavailableDates?.[date]) return 0;
    
    const maxSlotsPerDate = doctor.maxSlotsPerDate || {};
    const dateSpecificSlots = maxSlotsPerDate[date];
    const globalSlots = doctor.maxSlots || 0;
    const maxSlots = dateSpecificSlots !== undefined ? dateSpecificSlots : globalSlots;
    

    
    // Count actual booked appointments (not just subtracting)
    const bookedSlots = appointments.filter(
      apt => apt.appointmentDate === date && 
             apt.doctorId === doctor.id && 
             apt.status !== 'cancelled'
    ).length;
    
    // Calculate available slots considering both unavailable time slots and booked slots
    const totalPossibleSlots = maxSlots;
    const actuallyAvailable = Math.max(0, totalPossibleSlots - bookedSlots);
    
    return actuallyAvailable;
  };

  const getTotalSlotsForDoctor = (doctor: Doctor, date: string): number => {
    if (doctor.unavailableDates?.[date]) return 0;
    
    const maxSlotsPerDate = doctor.maxSlotsPerDate || {};
    const dateSpecificSlots = maxSlotsPerDate[date];
    const globalSlots = doctor.maxSlots || 0;
    return dateSpecificSlots !== undefined ? dateSpecificSlots : globalSlots;
  };

const isTimeSlotAvailable = (time: string): boolean => {
  if (!selectedDoctor || !selectedDate) return false;
  
  // Check if time is in doctor's unavailable slots
  const unavailableSlots = selectedDoctor.availableSlots?.[selectedDate] || [];
  if (unavailableSlots.includes(time)) return false;
  
  // Check if time is already booked
  const isBooked = appointments.some(
    apt => apt.appointmentDate === selectedDate &&
           apt.timeSlot === time &&  // ✅ FIXED: Changed from appointmentTime to timeSlot
           apt.doctor === selectedDoctor.name &&  // ✅ FIXED: Changed from doctorId to doctor (name)
           apt.status !== 'cancelled'
  );
  
  return !isBooked;
};

  // ============= Event Handlers =============
  const handleDateSelect = (date: string) => {
    const isPast = new Date(date) < new Date(new Date().toISOString().split('T')[0]);
    if (isPast) {
      toast.warning('Cannot book appointments for past dates');
      return;
    }
    
    const totalSlots = getTotalSlotsForDate(date);
    if (totalSlots === 0) {
      toast.warning('No doctors available on this date');
      return;
    }
    
    setSelectedDate(date);
    setStep(2);
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    const availableSlots = getAvailableSlotsForDoctor(doctor, selectedDate!);
    if (availableSlots === 0) {
      toast.warning('No available slots for this doctor on the selected date');
      return;
    }
    
    setSelectedDoctor(doctor);
    setStep(3);
  };

const handleTimeSelect = (time: string) => {
  if (!isTimeSlotAvailable(time)) {
    toast.warning('This time slot is no longer available');
    return;
  }
  
  setSelectedTime(time);
  // Open the AppointmentModal with pre-filled data
  setIsAppointmentModalOpen(true);
  // Only close the calendar modal visually without resetting data
};

const handleAppointmentModalClose = () => {
  setIsAppointmentModalOpen(false);
  setSelectedTime(null);
  // Don't reset other states so user can go back if needed
};

  const handleAppointmentBooked = () => {
    // Refresh data when appointment is booked
    loadData();
    if (onBookingComplete) onBookingComplete();
    handleClose();
  };

 const handleClose = () => {
  // Only reset when actually closing the entire wizard
  setStep(1);
  setSelectedDate(null);
  setSelectedDoctor(null);
  setSelectedTime(null);
  setIsAppointmentModalOpen(false);
  onClose();
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

  // ============= Render =============
  return (
    <>
     <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-700">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {step === 1 && 'Select Date'}
                {step === 2 && 'Choose Doctor'}
                {step === 3 && 'Pick Time Slot'}
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                {step === 1 && 'View appointment availability and select a date'}
                {step === 2 && 'Select your preferred doctor'}
                {step === 3 && `Available slots for Dr. ${selectedDoctor?.name} on ${selectedDate ? new Date(selectedDate).toLocaleDateString() : ''}`}
              </p>
            </div>
            <button
            onClick={handleClose}
            className="p-2 rounded-lg transition text-white"
          >
            <X className="w-6 h-6" />
          </button>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  1
                </div>
                <span className={`text-sm font-medium ${step >= 1 ? 'text-blue-600' : 'text-gray-500'}`}>
                  DATE
                </span>
              </div>
              
              <div className={`h-1 w-16 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  2
                </div>
                <span className={`text-sm font-medium ${step >= 2 ? 'text-blue-600' : 'text-gray-500'}`}>
                  DOCTOR
                </span>
              </div>
              
              <div className={`h-1 w-16 rounded ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  3
                </div>
                <span className={`text-sm font-medium ${step >= 3 ? 'text-blue-600' : 'text-gray-500'}`}>
                  TIME
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Step 1: Date Selection */}
                {step === 1 && (
                  <div>
                    <div className="flex items-center justify-center mb-6">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <h3 className="text-xl font-semibold text-gray-800 text-center min-w-[200px]">
                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                      </h3>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                        <div key={day} className="p-2 text-center text-xs font-semibold text-gray-600 bg-gray-100 rounded">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      
                      {generateCalendarDays().map(date => {
                        const bookedSlots = getBookedSlotsForDate(date);
                        const totalSlots = getTotalSlotsForDate(date);
                        const isToday = date === new Date().toISOString().split('T')[0];
                        const isPast = new Date(date) < new Date(new Date().toISOString().split('T')[0]);
                        const hasSlots = totalSlots > 0;

                        return (
                          <button
                            key={date}
                            onClick={() => handleDateSelect(date)}
                            disabled={isPast || !hasSlots}
                            className={`p-3 rounded-lg border-2 transition min-h-[70px] flex flex-col items-center justify-between ${
                              isToday
                                ? 'border-blue-600 bg-blue-50'
                                : isPast || !hasSlots
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                                : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer'
                            }`}
                          >
                            <span className={`text-sm font-semibold ${
                              isToday ? 'text-blue-700' : isPast ? 'text-gray-400' : 'text-gray-700'
                            }`}>
                              {new Date(date).getDate()}
                            </span>
                            {!isPast && hasSlots && (
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                bookedSlots === totalSlots
                                  ? 'bg-red-100 text-red-700'
                                  : bookedSlots > totalSlots / 2
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {bookedSlots}/{totalSlots}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2: Doctor Selection */}
                {step === 2 && selectedDate && (
                  <div>
                    <button
                      onClick={() => setStep(1)}
                      className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Calendar
                    </button>

                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Calendar className="w-5 h-5" />
                        <span className="font-semibold">Selected Date:</span>
                        <span>{formatDate(selectedDate)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {doctors.map(doctor => {
                        const availableSlots = getAvailableSlotsForDoctor(doctor, selectedDate);
                        const totalSlots = getTotalSlotsForDoctor(doctor, selectedDate);
                        const isUnavailable = availableSlots === 0;

                        return (
                          <button
                            key={doctor.id}
                            onClick={() => handleDoctorSelect(doctor)}
                            disabled={isUnavailable}
                            className={`flex items-center gap-4 p-4 rounded-lg border-2 transition text-left ${
                              isUnavailable
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                : 'border-gray-300 bg-white hover:border-blue-500 hover:shadow-lg cursor-pointer'
                            }`}
                          >
                            {doctor.photo ? (
                              <img
                                src={doctor.photo}
                                alt={`Dr. ${doctor.name}`}
                                className="w-16 h-16 rounded-full object-cover border-2 border-blue-200"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200">
                                <User className="w-8 h-8 text-blue-600" />
                              </div>
                            )}
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900">Dr. {doctor.name}</h3>
                              <p className="text-sm text-gray-600">{doctor.specialty}</p>
                              <div className="mt-2">
                                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                  isUnavailable
                                    ? 'bg-red-100 text-red-700'
                                    : availableSlots <= 3
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {isUnavailable ? 'No slots' : `${availableSlots}/${totalSlots} slots available`}
                                </span>
                              </div>
                            </div>
                            {!isUnavailable && <ChevronRight className="w-5 h-5 text-gray-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 3: Time Selection */}
                {step === 3 && selectedDoctor && selectedDate && (
                  <div>
                    <button
                      onClick={() => setStep(2)}
                      className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Doctors
                    </button>

                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-4">
                        {selectedDoctor.photo ? (
                          <img
                            src={selectedDoctor.photo}
                            alt={`Dr. ${selectedDoctor.name}`}
                            className="w-16 h-16 rounded-full object-cover border-2 border-blue-300"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-blue-200 flex items-center justify-center">
                            <User className="w-8 h-8 text-blue-700" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900">Dr. {selectedDoctor.name}</h3>
                          <p className="text-sm text-blue-700">{selectedDoctor.specialty}</p>
                          <p className="text-xs text-blue-600 mt-1">
                            Hours: 9:00 AM - 5:00 PM
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Available Time Slots
                      </h3>
               <div className="max-h-[400px] overflow-y-auto">
              {(() => {
                const timeSlots = generateTimeSlots();
                const hasAvailableSlots = timeSlots.some(time => isTimeSlotAvailable(time));
                
                if (!hasAvailableSlots) {
                  // NO SLOTS AVAILABLE - Show warning only, NO time slot grid
                  return (
                    <div className="text-center py-12 border-2 border-red-300 rounded-lg bg-red-50">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">⚠️</span>
                      </div>
                      <h4 className="text-xl font-bold text-red-800 mb-3">No available time slots.</h4>
                      <p className="text-red-700 mb-6">
                        All time slots for Dr. {selectedDoctor?.name} on {selectedDate ? new Date(selectedDate).toLocaleDateString() : ''} are fully booked.
                      </p>
                      <button
                        onClick={() => setStep(2)}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                      >
                        Choose Another Doctor
                      </button>
                    </div>
                  );
                }
                
                // SLOTS AVAILABLE - Show only available time slots
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {timeSlots
                      .filter(time => isTimeSlotAvailable(time)) // Only show available slots
                      .map(time => {
                        const isSelected = selectedTime === time;
                        
                        return (
                          <button
                            key={time}
                            onClick={() => handleTimeSelect(time)}
                            className={`p-3 rounded-lg text-sm font-medium transition border-2 ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <span className="font-semibold">{formatTo12Hour(time)}</span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                );
              })()}
            </div>
                                </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={handleAppointmentModalClose}
        // You can pass pre-filled data here if needed
        preFilledData={{
          doctor: selectedDoctor?.name || '',
          appointmentDate: selectedDate || '',
          timeSlot: selectedTime || ''
        }}
        onBookingComplete={handleAppointmentBooked}
      />
    </>
  );
};

export default CalendarWizardModal;