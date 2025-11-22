import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, ChevronLeft, ChevronRight, User, Clock, ArrowLeft, AlertCircle } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { toast } from 'react-toastify';
import AppointmentModal from './AppointmentModal';

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
  fullName: string;
  age: string;
  photo?: string;
  doctor: string;
  appointmentDate: string;
  gender: string;
  medicalCondition: string;
  phone: string;
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
  status: string;
  createdAt: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  isBuffer?: boolean;
  bufferType?: 'urgent' | 'emergency';
  isBooked?: boolean;
  isUnavailable?: boolean;
}

interface BookingEligibility {
  canBook: boolean;
  reason: string;
  dailyLimits?: {
    normal: number;
    urgent: number;
    emergency: number;
  };
  totalActive?: number;
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
  const [priorityLevel, setPriorityLevel] = useState<string>('normal');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [hasAvailableSlots, setHasAvailableSlots] = useState<boolean | undefined>(true);
  const [bookingEligibility, setBookingEligibility] = useState<BookingEligibility | null>(null);

  // Load doctors and appointments
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Check booking eligibility when modal opens
  useEffect(() => {
    if (isOpen) {
      checkBookingEligibility();
    }
  }, [isOpen]);

  const generateTimeSlots = useCallback(async (priorityLevel: string, doctor: Doctor, appointmentDate: string) => {
    console.log(`\n🔄 Calendar Wizard: Generating time slots for ${doctor.name} on ${appointmentDate}, priority: ${priorityLevel}`);
    
    setIsCheckingAvailability(true);
    
    const isFullyBooked = await isDoctorFullyBooked(doctor, appointmentDate);
    
    if (isFullyBooked) {
      console.log('🚫 Calendar Wizard: DOCTOR IS FULLY BOOKED - No slots available');
      setAvailableTimeSlots([]);
      setHasAvailableSlots(false);
      setIsCheckingAvailability(false);
      return;
    }
    
    const slots: TimeSlot[] = [];
    const startHour = 8;
    const endHour = 17;
    
    const bookedSlots = await getBookedTimeSlots(doctor.name, appointmentDate);
    console.log('📋 Calendar Wizard: Booked slots:', bookedSlots);
    
    const unavailableTimeSlots = doctor.availableSlots?.[appointmentDate] || [];
    console.log('⛔ Calendar Wizard: Unavailable time slots:', unavailableTimeSlots);

    if (priorityLevel === 'normal') {
      for (let hour = startHour; hour < endHour; hour++) {
        if (hour === 12) continue;
        
        const timeString = `${hour.toString().padStart(2, '0')}:00`;
        const isBooked = bookedSlots.includes(timeString);
        const isPast = isPastTime(appointmentDate, timeString);
        const isUnavailable = unavailableTimeSlots.includes(timeString);
        const isAvailable = !isBooked && !isUnavailable && !isPast;
        
        slots.push({
          time: timeString,
          available: isAvailable,
          isBooked,
          isUnavailable
        });
        
        console.log(`  ${timeString}: ${isAvailable ? '✅ Available' : '❌ Unavailable'} (booked: ${isBooked}, unavailable: ${isUnavailable}, past: ${isPast})`);
      }
    } else if (priorityLevel === 'urgent') {
      for (let hour = startHour; hour < endHour; hour++) {
        if (hour === 12) continue;
        
        const timeString = `${hour.toString().padStart(2, '0')}:30`;
        const isBooked = bookedSlots.includes(timeString);
        const isPast = isPastTime(appointmentDate, timeString);
        const isUnavailable = unavailableTimeSlots.includes(timeString);
        const isAvailable = !isBooked && !isUnavailable && !isPast;
        
        slots.push({
          time: timeString,
          available: isAvailable,
          isBooked,
          isUnavailable,
          isBuffer: true,
          bufferType: 'urgent'
        });
        
        console.log(`  ${timeString}: ${isAvailable ? '✅ Available' : '❌ Unavailable'} (booked: ${isBooked}, unavailable: ${isUnavailable}, past: ${isPast})`);
      }
    } else if (priorityLevel === 'emergency') {
      for (let hour = startHour; hour < endHour; hour++) {
        if (hour === 12) continue;
        
        const timeString15 = `${hour.toString().padStart(2, '0')}:15`;
        const isBooked15 = bookedSlots.includes(timeString15);
        const isPast15 = isPastTime(appointmentDate, timeString15);
        const isUnavailable15 = unavailableTimeSlots.includes(timeString15);
        const isAvailable15 = !isBooked15 && !isUnavailable15 && !isPast15;
        
        slots.push({
          time: timeString15,
          available: isAvailable15,
          isBooked: isBooked15,
          isUnavailable: isUnavailable15,
          isBuffer: true,
          bufferType: 'emergency'
        });
        
        console.log(`  ${timeString15}: ${isAvailable15 ? '✅ Available' : '❌ Unavailable'} (booked: ${isBooked15}, unavailable: ${isUnavailable15}, past: ${isPast15})`);
        
        const timeString45 = `${hour.toString().padStart(2, '0')}:45`;
        const isBooked45 = bookedSlots.includes(timeString45);
        const isPast45 = isPastTime(appointmentDate, timeString45);
        const isUnavailable45 = unavailableTimeSlots.includes(timeString45);
        const isAvailable45 = !isBooked45 && !isUnavailable45 && !isPast45;
        
        slots.push({
          time: timeString45,
          available: isAvailable45,
          isBooked: isBooked45,
          isUnavailable: isUnavailable45,
          isBuffer: true,
          bufferType: 'emergency'
        });
        
        console.log(`  ${timeString45}: ${isAvailable45 ? '✅ Available' : '❌ Unavailable'} (booked: ${isBooked45}, unavailable: ${isUnavailable45}, past: ${isPast45})`);
      }
    }

    const actuallyAvailableSlots = slots.filter(slot => 
      slot.available && !slot.isBooked && !slot.isUnavailable
    );
    const anyAvailable = actuallyAvailableSlots.length > 0;

    setHasAvailableSlots(anyAvailable);
    setAvailableTimeSlots(slots);

    console.log(`✅ Calendar Wizard: Generated ${slots.length} total slots`);
    console.log(`✅ Calendar Wizard: Actually available slots: ${actuallyAvailableSlots.length}`);
    console.log(`✅ Calendar Wizard: Booked slots: ${slots.filter(s => s.isBooked).length}`);
    console.log(`✅ Calendar Wizard: Unavailable slots: ${slots.filter(s => s.isUnavailable).length}`);
    console.log(`✅ Calendar Wizard: hasAvailableSlots set to: ${anyAvailable}`);

    if (anyAvailable) {
      console.log('Calendar Wizard: Available times:', actuallyAvailableSlots.map(s => s.time).join(', '));
    } else {
      console.log('⚠️ Calendar Wizard: NO AVAILABLE SLOTS - Should show warning');
    }
    
    setIsCheckingAvailability(false);
  }, []);

  // Generate time slots when doctor, date, or priority level changes
  useEffect(() => {
    if (selectedDoctor && selectedDate && priorityLevel) {
      generateTimeSlots(priorityLevel, selectedDoctor, selectedDate);
    } else {
      setAvailableTimeSlots([]);
      setHasAvailableSlots(true);
    }
  }, [selectedDoctor, selectedDate, priorityLevel, generateTimeSlots]);

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

      const appointmentsRef = collection(db, 'staff_appointments');
      const q = query(appointmentsRef, where('status', 'in', ['pending', 'confirmed', 'scheduled']));
      const appointmentsSnapshot = await getDocs(q);
      const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];
      
      console.log('📊 Calendar Wizard - Loaded appointments:', appointmentsData.length);
      setAppointments(appointmentsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  };

  const checkBookingEligibility = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) {
      setBookingEligibility({ canBook: true, reason: '', dailyLimits: { normal: 0, urgent: 0, emergency: 0 }, totalActive: 0 });
      return;
    }

    try {
      const userEmail = currentUser.email;
      if (!userEmail) {
        setBookingEligibility({ canBook: false, reason: 'User email not found. Please log in again.' });
        return;
      }

      // CRITICAL: Check user restriction status FIRST
      const userQuery = query(collection(db, 'users'), where('__name__', '==', currentUser.uid));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        const isRestricted = userData.isRestricted || false;
        const noShowCount = userData.noShowCount || 0;

        console.log('🔍 Calendar Wizard - User restriction check:', { 
          email: userEmail, 
          isRestricted, 
          noShowCount,
          restrictionReason: userData.restrictionReason 
        });

        // CRITICAL: Block booking if user is restricted OR has 3+ no-shows
        if (isRestricted || noShowCount >= 3) {
          const reason = isRestricted 
            ? (userData.restrictionReason || 'Your account has been restricted by an administrator.')
            : 'Your booking privileges are suspended due to multiple no-shows (3 or more).';
          
          setBookingEligibility({
            canBook: false,
            reason: `🚫 ${reason} Please contact the clinic to restore your booking access.`,
            totalActive: 0
          });
          
          console.error('🚫 Calendar Wizard - USER BLOCKED FROM BOOKING:', reason);
          return;
        }
      }

      // If not restricted, user can book
      setBookingEligibility({ 
        canBook: true, 
        reason: '',
        dailyLimits: { normal: 0, urgent: 0, emergency: 0 },
        totalActive: 0
      });
    } catch (error) {
      console.error('Calendar Wizard - Error checking booking eligibility:', error);
      setBookingEligibility({ 
        canBook: false, 
        reason: 'Unable to verify booking eligibility. Please try again.',
        dailyLimits: { normal: 0, urgent: 0, emergency: 0 },
        totalActive: 0
      });
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

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const isPastTime = (date: string, time: string): boolean => {
    const now = new Date();
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    const appointmentDateTime = new Date(year, month - 1, day, hours, minutes);
    const bufferTime = new Date(now.getTime() + 30 * 60 * 1000);
    
    const isPast = appointmentDateTime <= bufferTime;
    
    console.log(`⏰ Calendar Wizard: Checking ${time} on ${date}: ${isPast ? 'PAST' : 'FUTURE'} (now: ${now.toLocaleTimeString()}, appointment: ${appointmentDateTime.toLocaleTimeString()})`);
    
    return isPast;
  };

  const getBookedTimeSlots = async (doctor: string, appointmentDate: string): Promise<string[]> => {
    if (!doctor || !appointmentDate) return [];
    
    try {
      const appointmentsRef = collection(db, 'staff_appointments');
      const q = query(
        appointmentsRef,
        where('doctor', '==', doctor),
        where('appointmentDate', '==', appointmentDate),
        where('status', 'in', ['pending', 'confirmed', 'scheduled'])
      );
      
      const querySnapshot = await getDocs(q);
      const bookedSlots = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📌 Calendar Wizard: Booked appointment found:', {
          doctor: data.doctor,
          date: data.appointmentDate,
          timeSlot: data.timeSlot,
          status: data.status
        });
        return data.timeSlot as string;
      });
      
      console.log('📋 Calendar Wizard: Total booked slots for', doctor, 'on', appointmentDate, ':', bookedSlots);
      return bookedSlots;
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      return [];
    }
  };

  const isDoctorFullyBooked = async (doctor: Doctor, appointmentDate: string): Promise<boolean> => {
    if (!doctor || !appointmentDate) return false;
    
    try {
      const unavailableDates = doctor.unavailableDates || {};
      if (unavailableDates[appointmentDate] === true) {
        console.log('🚫 Calendar Wizard: Doctor is marked as unavailable on this date');
        return true;
      }
      
      const maxSlotsPerDate = doctor.maxSlotsPerDate || {};
      const dateSpecificMaxSlots = maxSlotsPerDate[appointmentDate];
      const globalMaxSlots = doctor.maxSlots || 10;
      const maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;
      
      console.log('📊 Calendar Wizard: Max slots for this date:', maxSlots);
      
      const appointmentsRef = collection(db, 'staff_appointments');
      const q = query(
        appointmentsRef,
        where('doctor', '==', doctor.name),
        where('appointmentDate', '==', appointmentDate),
        where('status', 'in', ['pending', 'confirmed', 'scheduled'])
      );
      
      const querySnapshot = await getDocs(q);
      const bookedCount = querySnapshot.size;
      
      console.log('📋 Calendar Wizard: Current booked appointments:', bookedCount);
      console.log('🔍 Calendar Wizard: Is fully booked?', bookedCount >= maxSlots);
      
      return bookedCount >= maxSlots;
    } catch (error) {
      console.error('Error checking if doctor is fully booked:', error);
      return false;
    }
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
      apt => apt.appointmentDate === date
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
    
    const unavailableTimeSlots = doctor.availableSlots?.[date] || [];
    const bookedSlots = appointments.filter(
      apt => apt.appointmentDate === date && 
             apt.doctor === doctor.name
    ).length;
    
    const totalPossibleSlots = Math.max(0, maxSlots - unavailableTimeSlots.length);
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
    setPriorityLevel('normal');
    setStep(3);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setIsAppointmentModalOpen(true);
  };

  const handleAppointmentModalClose = () => {
    setIsAppointmentModalOpen(false);
    setSelectedTime(null);
  };

  const handleAppointmentBooked = () => {
    loadData();
    if (onBookingComplete) onBookingComplete();
    handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setSelectedDate(null);
    setSelectedDoctor(null);
    setSelectedTime(null);
    setPriorityLevel('normal');
    setAvailableTimeSlots([]);
    setHasAvailableSlots(true);
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
            {/* CRITICAL: Restriction Warning Banner */}
            {bookingEligibility && !bookingEligibility.canBook && (
              <div className="mb-6 p-4 bg-red-100 border-2 border-red-500 rounded-lg shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 bg-red-500 p-2 rounded-full">
                    <AlertCircle className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-red-900 mb-1">
                      Account Restricted
                    </h4>
                    <p className="text-sm text-red-800 font-medium">
                      {bookingEligibility.reason}
                    </p>
                    <div className="mt-3 p-3 bg-white rounded border border-red-300">
                      <p className="text-xs text-gray-700">
                        <strong>Note:</strong> All booking functions are disabled while your account is restricted. 
                        You cannot select dates, doctors, or time slots.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                            disabled={isPast || !hasSlots || (bookingEligibility && !bookingEligibility.canBook)}
                            className={`p-3 rounded-lg border-2 transition min-h-[70px] flex flex-col items-center justify-between ${
                              isToday
                                ? 'border-blue-600 bg-blue-50'
                                : isPast || !hasSlots || (bookingEligibility && !bookingEligibility.canBook)
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                                : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer'
                            }`}
                            title={bookingEligibility && !bookingEligibility.canBook ? 'Your account is restricted from booking' : ''}
                          >
                            <span className={`text-sm font-semibold ${
                              isToday ? 'text-blue-700' : isPast ? 'text-gray-400' : 'text-gray-700'
                            }`}>
                              {new Date(date).getDate()}
                            </span>
                            {!isPast && hasSlots && !(bookingEligibility && !bookingEligibility.canBook) && (
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
                            {bookingEligibility && !bookingEligibility.canBook && !isPast && (
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                                Restricted
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
                            disabled={isUnavailable || (bookingEligibility && !bookingEligibility.canBook)}
                            className={`flex items-center gap-4 p-4 rounded-lg border-2 transition text-left ${
                              isUnavailable || (bookingEligibility && !bookingEligibility.canBook)
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
                                  bookingEligibility && !bookingEligibility.canBook
                                    ? 'bg-red-100 text-red-700'
                                    : isUnavailable
                                    ? 'bg-red-100 text-red-700'
                                    : availableSlots <= 3
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {bookingEligibility && !bookingEligibility.canBook
                                    ? '🚫 Account Restricted'
                                    : isUnavailable 
                                    ? 'No slots' 
                                    : `${availableSlots}/${totalSlots} slots available`}
                                </span>
                              </div>
                            </div>
                            {!isUnavailable && !(bookingEligibility && !bookingEligibility.canBook) && <ChevronRight className="w-5 h-5 text-gray-400" />}
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
                            Hours: 8:00 AM - 5:00 PM
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Priority Level Selection */}
                    <div className="mb-6">
                      <label htmlFor="priorityLevel" className="block text-sm font-medium text-gray-700 mb-2">
                        Priority Level
                      </label>
                      <select
                        id="priorityLevel"
                        name="priorityLevel"
                        value={priorityLevel}
                        onChange={(e) => setPriorityLevel(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={bookingEligibility && !bookingEligibility.canBook}
                      >
                        <option value="normal">Normal (1 hour slots)</option>
                        <option value="urgent">Urgent (30 minute buffer slots)</option>
                        <option value="emergency">Emergency (15 minute buffer slots)</option>
                      </select>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Available Time Slots
                      </h3>
                      
                      {isCheckingAvailability ? (
                        <div className="text-center py-8 border-2 border-gray-200 rounded-lg bg-gray-50">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          <h4 className="text-xl font-bold text-gray-700 mb-2">Checking availability...</h4>
                          <p className="text-gray-600">Please wait while we load available time slots.</p>
                        </div>
                      ) : !hasAvailableSlots ? (
                        <div className="text-center py-8 border-2 border-orange-300 rounded-lg bg-orange-50">
                          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⚠️</span>
                          </div>
                          <h4 className="text-xl font-bold text-orange-800 mb-2">No available time slots</h4>
                          <p className="text-orange-700 mb-6 px-4">
                            Dr. {selectedDoctor?.name} is fully booked for {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            }) : ''}. Please select another doctor, date, or priority level.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center px-4">
                            <button
                              onClick={() => setStep(2)}
                              className="px-6 py-3 bg-white text-orange-700 border-2 border-orange-300 rounded-lg font-medium hover:bg-orange-50 transition"
                            >
                              📅 Choose Another Doctor/Date
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                          {availableTimeSlots.map((slot) => {
                            // CRITICAL: Disable all slots if user is restricted
                            const isUserRestricted = bookingEligibility && !bookingEligibility.canBook && 
                              bookingEligibility.reason.includes('🚫');
                            
                            const isAvailable = !isUserRestricted && slot.available && !slot.isBooked && !slot.isUnavailable;
                            const isBooked = slot.isBooked;
                            const isUnavailable = slot.isUnavailable && !slot.isBooked;
                            
                            let buttonClasses = 'px-3 py-3 rounded-lg text-sm font-medium transition border-2 ';
                            let statusLabel = '';
                            let statusLabelClasses = '';
                            
                            // If user is restricted, show all slots as disabled
                            if (isUserRestricted) {
                              buttonClasses += 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-50';
                              statusLabel = 'Restricted';
                              statusLabelClasses = 'text-xs mt-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold';
                            } else if (isBooked) {
                              buttonClasses += 'bg-red-50 text-red-700 border-red-300 cursor-not-allowed opacity-75';
                              statusLabel = 'Booked';
                              statusLabelClasses = 'text-xs mt-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold';
                            } else if (isUnavailable) {
                              buttonClasses += 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed opacity-60';
                              statusLabel = 'Unavailable';
                              statusLabelClasses = 'text-xs mt-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-600';
                            } else if (isAvailable) {
                              buttonClasses += 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100 cursor-pointer';
                              statusLabel = 'Available';
                              statusLabelClasses = 'text-xs mt-1 px-2 py-0.5 rounded-full bg-white bg-opacity-70';
                            } else {
                              buttonClasses += 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed opacity-60';
                              statusLabel = 'Unavailable';
                              statusLabelClasses = 'text-xs mt-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-600';
                            }
                            
                            if (selectedTime === slot.time && isAvailable && !isUserRestricted) {
                              buttonClasses += ' ring-2 ring-blue-500 ring-offset-2';
                            }
                            
                            return (
                              <button
                                key={slot.time}
                                onClick={() => {
                                  if (isAvailable && !isUserRestricted) {
                                    handleTimeSelect(slot.time);
                                  }
                                }}
                                disabled={!isAvailable || !!isUserRestricted}
                                className={buttonClasses}
                                aria-pressed={selectedTime === slot.time ? "true" : "false"}
                                aria-disabled={!isAvailable || !!isUserRestricted}
                                title={isUserRestricted ? 'Your account is restricted from booking' : ''}
                              >
                                <div className="flex flex-col items-center">
                                  <span className="font-semibold">{convertTo12Hour(slot.time)}</span>
                                  <span className={statusLabelClasses}>
                                    {statusLabel}
                                  </span>
                                  {slot.isBuffer && slot.bufferType === 'emergency' && isAvailable && !isUserRestricted && (
                                    <span className="text-xs mt-1 text-red-600 font-semibold">Emergency</span>
                                  )}
                                  {slot.isBuffer && slot.bufferType === 'urgent' && isAvailable && !isUserRestricted && (
                                    <span className="text-xs mt-1 text-orange-600 font-semibold">Urgent</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
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
        preFilledData={{
          doctor: selectedDoctor?.name || '',
          appointmentDate: selectedDate || '',
          timeSlot: selectedTime || '',
        }}
        onBookingComplete={handleAppointmentBooked}
      />
    </>
  );
};

export default CalendarWizardModal;