import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Info, Upload } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, doc, runTransaction, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preFilledData?: {
    doctor: string;
    appointmentDate: string;
    timeSlot: string;
  };
  onBookingComplete?: () => void;
}

interface TimeSlot {
  time: string;
  available: boolean;
  isBuffer?: boolean;
  bufferType?: 'urgent' | 'emergency';
  isBooked?: boolean;
  isUnavailable?: boolean;
}

interface Appointment {
  id?: string;
  fullName: string;
  age: string;
  photo: string;
  doctor: string;
  appointmentDate: string;
  gender: string;
  medicalCondition: string;
  phone: string;
  email: string;
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
  status: string;
  createdAt: string;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  isActive: boolean;
  maxSlots: number;
  maxSlotsPerDate?: { [date: string]: number };
  availableSlots: { [date: string]: string[] }; 
  unavailableDates?: { [date: string]: boolean };
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

const AppointmentModal = ({ isOpen, onClose, preFilledData, onBookingComplete }: AppointmentModalProps) => {
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    photo: '',
    doctor: '',
    appointmentDate: '',
    gender: '',
    medicalCondition: '',
    customCondition: '',
    phone: '',
    priorityLevel: 'normal',
    timeSlot: ''
  });

  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAvailableSlots, setHasAvailableSlots] = useState(true);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isDoctorUnavailable, setIsDoctorUnavailable] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [bookingEligibility, setBookingEligibility] = useState<BookingEligibility | null>(null);

  const eyeConditions = [
    'Blurred Vision',
    'Eye Pain',
    'Redness',
    'Itching',
    'Dry Eyes',
    'Watery Eyes',
    'Light Sensitivity',
    'Double Vision',
    'Floaters',
    'Eye Strain',
    'Cataracts',
    'Glaucoma',
    'Macular Degeneration',
    'Diabetic Retinopathy',
    'Routine Eye Exam',
    'Contact Lens Fitting',
    'Eyeglasses Prescription',
    'Other (Please Specify)'
  ];
  
  useEffect(() => {
    if (isOpen && preFilledData) {
      setFormData(prev => ({
        ...prev,
        doctor: preFilledData.doctor,
        appointmentDate: preFilledData.appointmentDate,
        timeSlot: preFilledData.timeSlot
      }));
    }
  }, [isOpen, preFilledData]);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadDoctors = useCallback(async () => {
    try {
      const doctorsRef = collection(db, 'doctors');
      const q = query(doctorsRef, where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      
      const doctorsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Doctor[];
      
      setDoctors(doctorsData);
    } catch (error) {
      console.error('Error loading doctors:', error);
      showToast('Failed to load doctors. Please check your permissions or try again.', 'error');
    }
  }, [showToast]); 

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

const checkBookingEligibility = useCallback(async () => {
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

      console.log('🔍 User restriction check:', { 
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
          reason: `🚫 ${reason} Please contact the clinic at [clinic contact] to restore your booking access.`,
          totalActive: 0
        });
        
        console.error('🚫 USER BLOCKED FROM BOOKING:', reason);
        return;
      }
    }

    // Continue with existing checks only if user is not restricted
    const appointmentsRef = collection(db, 'patient_appointments');
    const allActiveQuery = query(
      appointmentsRef,
      where('email', '==', userEmail),
      where('status', 'in', ['pending', 'confirmed', 'scheduled'])
    );
    
    const allActiveSnapshot = await getDocs(allActiveQuery);
    const totalActiveAppointments = allActiveSnapshot.size;

    console.log('📊 Total active appointments:', totalActiveAppointments);

    if (totalActiveAppointments >= 2) {
      setBookingEligibility({
        canBook: false,
        reason: 'You have reached the maximum limit of 2 active appointments. Please complete or cancel an existing appointment before booking a new one.',
        totalActive: totalActiveAppointments
      });
      return;
    }

    if (formData.appointmentDate) {
      const dailyQuery = query(
        appointmentsRef,
        where('email', '==', userEmail),
        where('appointmentDate', '==', formData.appointmentDate),
        where('status', 'in', ['pending', 'confirmed', 'scheduled'])
      );
      
      const dailySnapshot = await getDocs(dailyQuery);
      
      const dailyCounts = {
        normal: 0,
        urgent: 0,
        emergency: 0
      };
      
      dailySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const priority = (data.priorityLevel || 'normal') as 'normal' | 'urgent' | 'emergency';
        if (priority in dailyCounts) {
          dailyCounts[priority]++;
        }
      });

      console.log('📊 Daily booking counts for', formData.appointmentDate, ':', dailyCounts);

      const selectedPriority = formData.priorityLevel;
      let limitReached = false;
      let limitMessage = '';

      if (selectedPriority === 'normal' && dailyCounts.normal >= 2) {
        limitReached = true;
        limitMessage = 'You have reached the daily limit of 2 Normal appointments for this date.';
      } else if (selectedPriority === 'urgent' && dailyCounts.urgent >= 1) {
        limitReached = true;
        limitMessage = 'You have reached the daily limit of 1 Urgent appointment for this date.';
      } else if (selectedPriority === 'emergency' && dailyCounts.emergency >= 1) {
        limitReached = true;
        limitMessage = 'You have reached the daily limit of 1 Emergency appointment for this date.';
      }

      if (limitReached) {
        setBookingEligibility({
          canBook: false,
          reason: limitMessage + ' Please choose another date or priority level.',
          dailyLimits: dailyCounts,
          totalActive: totalActiveAppointments
        });
        return;
      }

      setBookingEligibility({ 
        canBook: true, 
        reason: '',
        dailyLimits: dailyCounts,
        totalActive: totalActiveAppointments
      });
    } else {
      setBookingEligibility({ 
        canBook: true, 
        reason: '',
        dailyLimits: { normal: 0, urgent: 0, emergency: 0 },
        totalActive: totalActiveAppointments
      });
    }
  } catch (error) {
    console.error('Error checking booking eligibility:', error);
    // On error, assume not eligible for safety
    setBookingEligibility({ 
      canBook: false, 
      reason: 'Unable to verify booking eligibility. Please try again.',
      dailyLimits: { normal: 0, urgent: 0, emergency: 0 },
      totalActive: 0
    });
  }
}, [formData.appointmentDate, formData.priorityLevel]);

  useEffect(() => {
    if (isOpen) {
      checkBookingEligibility();
    }
  }, [isOpen, formData.appointmentDate, formData.priorityLevel, checkBookingEligibility]);

    const convertTo12Hour = (time24: string): string => {    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

const getBookedTimeSlots = useCallback(async (doctor: string, appointmentDate: string): Promise<string[]> => {
  if (!doctor || !appointmentDate) return [];
  
  try {
    // ✅ FIXED: Query ONLY patient_appointments (primary collection) to avoid double-counting
    const patientRef = collection(db, 'patient_appointments');
    
    const patientQuery = query(
      patientRef,
      where('doctor', '==', doctor),
      where('appointmentDate', '==', appointmentDate),
      where('status', 'in', ['pending', 'confirmed', 'scheduled'])
    );
    
    const patientSnapshot = await getDocs(patientQuery);
    
    // Get booked slots from primary collection only
    const bookedSlots = patientSnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      console.log('📌 Booked appointment found:', {
        doctor: data.doctor,
        date: data.appointmentDate,
        timeSlot: data.timeSlot,
        status: data.status
      });
      return data.timeSlot as string;
    });
    
    // No need to remove duplicates since we're only querying one collection
    const uniqueBookedSlots = bookedSlots;
    
    // Get slot locks
    const slotLocksRef = collection(db, 'slot_locks');
    const locksQuery = query(
      slotLocksRef,
      where('doctor', '==', doctor),
      where('appointmentDate', '==', appointmentDate)
    );
    
    const locksSnapshot = await getDocs(locksQuery);
    
    // Only include slot locks that have a matching active appointment
    const validLockedSlots: string[] = [];
    const orphanLocks: string[] = [];
    
    for (const lockDoc of locksSnapshot.docs) {
      const lockData = lockDoc.data();
      const lockTimeSlot = lockData.timeSlot as string;
      
      if (uniqueBookedSlots.includes(lockTimeSlot)) {
        validLockedSlots.push(lockTimeSlot);
        console.log('🔒 Valid slot lock found:', {
          doctor: lockData.doctor,
          date: lockData.appointmentDate,
          timeSlot: lockTimeSlot,
          bookedAt: lockData.bookedAt
        });
      } else {
        orphanLocks.push(lockTimeSlot);
        console.log('⚠️ Orphan slot lock found (will be cleaned up):', {
          doctor: lockData.doctor,
          date: lockData.appointmentDate,
          timeSlot: lockTimeSlot
        });
        
        // Auto-cleanup: Delete the orphan lock
        try {
          const orphanLockRef = doc(db, 'slot_locks', `${doctor}_${appointmentDate}_${lockTimeSlot}`);
          await deleteDoc(orphanLockRef);
          console.log('🗑️ Orphan slot lock deleted:', lockTimeSlot);
        } catch (error) {
          console.error('Failed to delete orphan lock:', error);
        }
      }
    }
    
    if (orphanLocks.length > 0) {
      console.log('🧹 Cleaned up', orphanLocks.length, 'orphan slot locks:', orphanLocks);
    }
    
    console.log('📋 Total booked slots for', doctor, 'on', appointmentDate, ':', uniqueBookedSlots);
    return uniqueBookedSlots;
  } catch (error) {
    console.error('Error fetching booked slots:', error);
    return [];
  }
}, []);

const isDoctorFullyBooked = useCallback(async (doctor: string, appointmentDate: string): Promise<{isFullyBooked: boolean; isUnavailable: boolean}> => {
  if (!doctor || !appointmentDate) return {isFullyBooked: false, isUnavailable: false};
  
  try {
    const doctorsRef = collection(db, 'doctors');
    const doctorQuery = query(doctorsRef, where('name', '==', doctor));
    const doctorSnapshot = await getDocs(doctorQuery);
    
    if (doctorSnapshot.empty) {
      console.error('âŒ Doctor not found in database:', doctor);
      return {isFullyBooked: false, isUnavailable: false};
    }
    
    const doctorData = doctorSnapshot.docs[0].data();
    
    const unavailableDates = doctorData.unavailableDates || {};
    if (unavailableDates[appointmentDate] === true) {
      console.log('ðŸš« Doctor is marked as unavailable on this date');
      return {isFullyBooked: false, isUnavailable: true};
    }
    
    const maxSlotsPerDate = doctorData.maxSlotsPerDate || {};
    const dateSpecificMaxSlots = maxSlotsPerDate[appointmentDate];
    const globalMaxSlots = doctorData.maxSlots || 10;
    const maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;
    
    console.log('ðŸ"Š DETAILED Doctor Availability Check:', {
      doctor: doctor,
      date: appointmentDate,
      rawMaxSlotsPerDate: maxSlotsPerDate,
      dateSpecificMaxSlots: dateSpecificMaxSlots,
      dateSpecificExists: dateSpecificMaxSlots !== undefined,
      globalMaxSlots: globalMaxSlots,
      finalMaxSlots: maxSlots,
      unavailableDates: unavailableDates,
      timestamp: new Date().toISOString()
    });
    
    if (maxSlots === 0) {
      console.log('🚫 Max slots is 0 - doctor is fully booked for this date');
      return {isFullyBooked: true, isUnavailable: false};
    }
    
    // ✅ FIXED: Count ONLY from patient_appointments (primary collection) to avoid double-counting
    const patientRef = collection(db, 'patient_appointments');
    
    const patientQuery = query(
      patientRef,
      where('doctor', '==', doctor),
      where('appointmentDate', '==', appointmentDate),
      where('status', 'in', ['pending', 'confirmed', 'scheduled'])
    );
    
    const patientSnapshot = await getDocs(patientQuery);
    const bookedCount = patientSnapshot.size;
    
    console.log('📋 Current booked appointments (from primary collection):', bookedCount);
    console.log('🔍 Is fully booked?', bookedCount >= maxSlots, `(${bookedCount} >= ${maxSlots})`);
    
    return {isFullyBooked: bookedCount >= maxSlots, isUnavailable: false};
  } catch (error) {
    console.error('Error checking if doctor is fully booked:', error);
    return {isFullyBooked: false, isUnavailable: false};
  }
}, []);
  const isPastTime = (date: string, time: string): boolean => {
    const now = new Date();
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    const appointmentDateTime = new Date(year, month - 1, day, hours, minutes);
    
    const bufferTime = new Date(now.getTime() + 30 * 60 * 1000);
    
    const isPast = appointmentDateTime <= bufferTime;
    
    console.log(`⏰ Checking ${time} on ${date}: ${isPast ? 'PAST' : 'FUTURE'} (now: ${now.toLocaleTimeString()}, appointment: ${appointmentDateTime.toLocaleTimeString()})`);
    
    return isPast;
  };

  const generateTimeSlots = useCallback(async (priorityLevel: string, doctor: string, appointmentDate: string) => {
    console.log(`\n🔄 Generating time slots for ${doctor} on ${appointmentDate}, priority: ${priorityLevel}`);
    
    setIsCheckingAvailability(true);
    
    const {isFullyBooked, isUnavailable} = await isDoctorFullyBooked(doctor, appointmentDate);
    
    if (isUnavailable) {
      console.log('🚫 DOCTOR IS UNAVAILABLE - No slots available');
      setAvailableTimeSlots([]);
      setHasAvailableSlots(false);
      setIsDoctorUnavailable(true);
      setIsCheckingAvailability(false);
      return;
    }
    
    setIsDoctorUnavailable(false);
    
    if (isFullyBooked) {
      console.log('🚫 DOCTOR IS FULLY BOOKED - No slots available');
      setAvailableTimeSlots([]);
      setHasAvailableSlots(false);
      setIsCheckingAvailability(false);
      return;
    }
    
    const slots: TimeSlot[] = [];
    const startHour = 8;
    const endHour = 17;
    
    const bookedSlots = await getBookedTimeSlots(doctor, appointmentDate);
    console.log('📋 Booked slots:', bookedSlots);
    
    const doctorsRef = collection(db, 'doctors');
    const doctorQuery = query(doctorsRef, where('name', '==', doctor));
    const doctorSnapshot = await getDocs(doctorQuery);
    
    let unavailableTimeSlots: string[] = [];
    
    if (!doctorSnapshot.empty) {
      const doctorData = doctorSnapshot.docs[0].data();
      unavailableTimeSlots = doctorData.availableSlots?.[appointmentDate] || [];
      console.log('⛔ Unavailable time slots:', unavailableTimeSlots);
    }

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
    }
    
    else if (priorityLevel === 'urgent') {
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

    console.log(`✅ Generated ${slots.length} total slots`);
    console.log(`✅ Actually available slots: ${actuallyAvailableSlots.length}`);
    console.log(`✅ Booked slots: ${slots.filter(s => s.isBooked).length}`);
    console.log(`✅ Unavailable slots: ${slots.filter(s=> s.isUnavailable).length}`);
    console.log(`✅ hasAvailableSlots set to: ${anyAvailable}`);

    if (anyAvailable) {
      console.log('Available times:', actuallyAvailableSlots.map(s => s.time).join(', '));
    } else {
      console.log('⚠️ NO AVAILABLE SLOTS - Should show warning');
    }
    
    setIsCheckingAvailability(false);
  }, [getBookedTimeSlots, isDoctorFullyBooked]);

  useEffect(() => {
    if (formData.doctor && formData.appointmentDate && formData.priorityLevel) {
      generateTimeSlots(formData.priorityLevel, formData.doctor, formData.appointmentDate);
    } else {
      setAvailableTimeSlots([]);
      setHasAvailableSlots(true);
      setIsDoctorUnavailable(false);
    }
  }, [formData.doctor, formData.appointmentDate, formData.priorityLevel, generateTimeSlots]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const compressImageForDisplay = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        
        let { width, height } = img;
        
        const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        let quality = 0.8;
        let attempts = 0;
        const maxAttempts = 3;
        
        const tryCompression = () => {
          let processedDataUrl;
          if (file.type === 'image/png' || file.type === 'image/gif') {
            processedDataUrl = canvas.toDataURL('image/png');
          } else if (file.type === 'image/webp') {
            processedDataUrl = canvas.toDataURL('image/webp', quality);
          } else {
            processedDataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          
          const sizeInKB = (processedDataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75 / 1024;
          
          console.log(`Image compression attempt ${attempts + 1}: Quality ${quality}, Size ${sizeInKB.toFixed(2)}KB`);
          
          if (sizeInKB < 2000 || attempts >= maxAttempts) {
            resolve(processedDataUrl);
          } else {
            quality -= 0.2;
            attempts++;
            setTimeout(tryCompression, 0);
          }
        };
        
        tryCompression();
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;

    const validTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif', 
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/svg+xml'
    ];
    
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a valid image file (JPEG, PNG, GIF, WebP, BMP, TIFF, or SVG).', 'error');
      return;
    }

    console.log('🖼️ Processing image:', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      dimensions: 'Processing...'
    });

    try {
      const tempReader = new FileReader();
      tempReader.onloadend = () => {
        const tempPhotoUrl = tempReader.result as string;
        setFormData(prev => ({ ...prev, photo: tempPhotoUrl }));
      };
      tempReader.readAsDataURL(file);

      const compressedBase64 = await compressImageForDisplay(file);
      
      setFormData(prev => ({ ...prev, photo: compressedBase64 }));
      
      console.log('✅ Image processed successfully for display');
      
    } catch (error) {
      console.error('Error processing image:', error);
      showToast('Error processing image. Please try again.', 'error');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      handlePhotoUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file);
    }
  };const handleSubmit = async () => {
  if (!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
      !formData.doctor || !formData.appointmentDate || !formData.timeSlot || !formData.medicalCondition) {
    showToast('Please fill in all required fields', 'warning');
    return;
  }

  if (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim()) {
    showToast('Please specify your medical condition', 'warning');
    return;
  }

  if (bookingEligibility && !bookingEligibility.canBook) {
    showToast('🚫 ' + bookingEligibility.reason, 'error');
    return;
  }

  const dailyLimits = bookingEligibility?.dailyLimits;
  if (dailyLimits) {
    const currentPriority = formData.priorityLevel;
    
    if (currentPriority === 'normal' && dailyLimits.normal >= 2) {
      showToast('❌ Daily limit reached: You can only book 2 Normal appointments per day. Choose another date or priority.', 'error');
      return;
    }
    
    if (currentPriority === 'urgent' && dailyLimits.urgent >= 1) {
      showToast('❌ Daily limit reached: You can only book 1 Urgent appointment per day. Choose another date or priority.', 'error');
      return;
    }
    
    if (currentPriority === 'emergency' && dailyLimits.emergency >= 1) {
      showToast('❌ Daily limit reached: You can only book 1 Emergency appointment per day. Choose another date or priority.', 'error');
      return;
    }
  }

  const userEmail = auth.currentUser?.email;
  if (!userEmail) {
    showToast('User email not found. Please log in again.', 'error');
    return;
  }

  setIsSubmitting(true);
  
  try {
    const finalMedicalCondition = formData.medicalCondition === 'Other (Please Specify)' 
      ? formData.customCondition 
      : formData.medicalCondition;

    const selectedDoctor = doctors.find(d => d.name === formData.doctor);
    
    if (selectedDoctor) {
      const unavailableDates = selectedDoctor.unavailableDates || {};
      if (unavailableDates[formData.appointmentDate] === true) {
        throw new Error('DOCTOR_UNAVAILABLE');
      }
    }
    
    // ✅ CRITICAL FIX: Fetch LATEST doctor data to get accurate maxSlotsPerDate
    const doctorsRef = collection(db, 'doctors');
    const doctorQuery = query(doctorsRef, where('name', '==', formData.doctor));
    const doctorSnapshot = await getDocs(doctorQuery);

    let maxSlots = 10; // Default fallback

    if (!doctorSnapshot.empty) {
      const latestDoctorData = doctorSnapshot.docs[0].data();
      const maxSlotsPerDate = latestDoctorData.maxSlotsPerDate || {};
      const dateSpecificMaxSlots = maxSlotsPerDate[formData.appointmentDate];
      const globalMaxSlots = latestDoctorData.maxSlots || 10;
      
      // Use date-specific slots if they exist (even if 0), otherwise use global
      maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;

      console.log('🔧 CRITICAL: Fetched LATEST max slots for booking check:', {
        doctor: formData.doctor,
        date: formData.appointmentDate,
        dateSpecificMaxSlots: dateSpecificMaxSlots,
        globalMaxSlots: globalMaxSlots,
        finalMaxSlots: maxSlots,
        maxSlotsPerDate: maxSlotsPerDate,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ Doctor not found in database:', formData.doctor);
      throw new Error('DOCTOR_NOT_FOUND');
    }

    // ✅ Check if max slots is 0 (completely blocked)
    if (maxSlots === 0) {
      console.log('🚫 Max slots is 0 - doctor is fully booked for this date');
      throw new Error('DOCTOR_FULLY_BOOKED');
    }

    const appointmentData = await runTransaction(db, async (transaction) => {
      const slotLockRef = doc(db, 'slot_locks', `${formData.doctor}_${formData.appointmentDate}_${formData.timeSlot}`);
      const slotLockDoc = await transaction.get(slotLockRef);

      if (slotLockDoc.exists()) {
        const lockData = slotLockDoc.data();
        console.log('🔒 Slot is locked:', lockData);
        throw new Error('SLOT_TAKEN');
      }

      // ✅ CRITICAL FIX: Fetch LATEST maxSlots INSIDE transaction to avoid stale data
      const doctorQueryInTransaction = query(
        collection(db, 'doctors'),
        where('name', '==', formData.doctor)
      );
      const doctorSnapshotInTransaction = await getDocs(doctorQueryInTransaction);

      let transactionMaxSlots = 10; // Default fallback

      if (!doctorSnapshotInTransaction.empty) {
        const transactionDoctorData = doctorSnapshotInTransaction.docs[0].data();
        const maxSlotsPerDate = transactionDoctorData.maxSlotsPerDate || {};
        const dateSpecificMaxSlots = maxSlotsPerDate[formData.appointmentDate];
        const globalMaxSlots = transactionDoctorData.maxSlots || 10;
        
        transactionMaxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;
        
        console.log('🔐 TRANSACTION: Using FRESH max slots:', {
          doctor: formData.doctor,
          date: formData.appointmentDate,
          dateSpecificMaxSlots: dateSpecificMaxSlots,
          globalMaxSlots: globalMaxSlots,
          finalMaxSlots: transactionMaxSlots,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error('❌ TRANSACTION: Doctor document not found');
        throw new Error('DOCTOR_NOT_FOUND');
      }

      // ✅ CRITICAL FIX: Query ONLY patient_appointments to avoid permission issues
      const patientRef = collection(db, 'patient_appointments');

      const patientQuery = query(
        patientRef,
        where('doctor', '==', formData.doctor),
        where('appointmentDate', '==', formData.appointmentDate),
        where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
      );

      // Only query patient_appointments (no need for staff_appointments query)
      const patientSnapshot = await getDocs(patientQuery);

      // ✅ Count ONLY from patient_appointments to avoid double-counting
      const currentBookedCount = patientSnapshot.size;
      console.log('📊 TRANSACTION: Current booked count (from patient_appointments only):', currentBookedCount, 'Max slots:', transactionMaxSlots);

      if (currentBookedCount >= transactionMaxSlots) {
        console.log('🚫 TRANSACTION: Doctor fully booked - cannot add new appointment');
        throw new Error('DOCTOR_FULLY_BOOKED');
      }

      // ✅ Get all existing appointments from patient_appointments only
      const allExistingAppointments = patientSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        timeSlot: doc.data().timeSlot, 
        queueNumber: doc.data().queueNumber,
        collection: 'patient_appointments'
      }));

      const uniqueAppointments = allExistingAppointments;

      // Add the NEW appointment
      const allAppointments = [
        ...uniqueAppointments,
        {
          id: 'NEW_APPOINTMENT',
          timeSlot: formData.timeSlot,
          queueNumber: 0, // Will be calculated
          collection: 'patient_appointments'
        }
      ];

      // Sort ALL appointments by time slot ONCE
      allAppointments.sort((a, b) => {
        const timeA = a.timeSlot.split(':').map(Number);
        const timeB = b.timeSlot.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
      });

      console.log('\n🎯 ===== QUEUE ASSIGNMENT (SORTED BY TIME) =====');
      allAppointments.forEach((apt, idx) => {
        console.log(`  Position ${idx + 1}: ${apt.timeSlot} - ${apt.id === 'NEW_APPOINTMENT' ? '🆕 NEW' : `ID: ${apt.id}`}`);
      });
      console.log('===============================================\n');

      // Reassign ALL queue numbers sequentially 1, 2, 3, 4... based ONLY on time order
      let queueNumber = 0;
      const appointmentsToUpdate: Array<{ id: string; collection: string; newQueueNumber: number }> = [];

      for (let i = 0; i < allAppointments.length; i++) {
        const appointment = allAppointments[i];
        const correctQueueNum = i + 1; // Sequential: 1, 2, 3, 4...
        
        if (appointment.id === 'NEW_APPOINTMENT') {
          queueNumber = correctQueueNum;
          console.log(`✅ NEW appointment gets queue #${queueNumber} at ${appointment.timeSlot}`);
        } else if (appointment.queueNumber !== correctQueueNum) {
          appointmentsToUpdate.push({
            id: appointment.id,
            collection: appointment.collection,
            newQueueNumber: correctQueueNum
          });
          console.log(`🔄 Updating ${appointment.id}: #${appointment.queueNumber} → #${correctQueueNum} (${appointment.timeSlot})`);
        }
      }

      console.log(`\n📊 Final: ${allAppointments.length} appointments with queue numbers 1-${allAppointments.length}\n`);

      // ✅ CRITICAL FIX: Update existing appointments in BOTH collections with proper error handling
      for (const update of appointmentsToUpdate) {
        try {
          const patientDocRef = doc(db, 'patient_appointments', update.id);
          const staffDocRef = doc(db, 'staff_appointments', update.id);
          
          // Get current data from patient collection
          const patientDoc = await transaction.get(patientDocRef);
          if (patientDoc.exists()) {
            const currentData = patientDoc.data();
            
            // Update both collections
            transaction.update(patientDocRef, { queueNumber: update.newQueueNumber });
            transaction.set(staffDocRef, { 
              ...currentData, 
              queueNumber: update.newQueueNumber 
            }, { merge: true });
            
            console.log(`✅ Updated queue #${update.newQueueNumber} for appointment ${update.id}`);
          }
        } catch (error) {
          console.error(`❌ Failed to update queue for appointment ${update.id}:`, error);
          // Continue with other updates even if one fails
        }
      }

      const appointment: Appointment = {
        fullName: formData.fullName,
        age: formData.age,
        photo: formData.photo,
        doctor: formData.doctor,
        appointmentDate: formData.appointmentDate,
        gender: formData.gender,
        medicalCondition: finalMedicalCondition,
        phone: formData.phone,
        email: userEmail,
        priorityLevel: formData.priorityLevel,
        timeSlot: formData.timeSlot,
        queueNumber: queueNumber,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // ✅ FIXED: Save to BOTH collections (patient booking appears everywhere)
      const appointmentId = doc(collection(db, 'patient_appointments')).id;
      const patientAppointmentRef = doc(db, 'patient_appointments', appointmentId);
      const staffAppointmentRef = doc(db, 'staff_appointments', appointmentId);

      // Save to both collections with same ID
      transaction.set(patientAppointmentRef, appointment);
      transaction.set(staffAppointmentRef, appointment);

      // Set slot lock
      transaction.set(slotLockRef, {
        doctor: formData.doctor,
        appointmentDate: formData.appointmentDate,
        timeSlot: formData.timeSlot,
        appointmentId: appointmentId,
        bookedAt: new Date().toISOString(),
        bookedBy: userEmail
      });

      return { appointmentId: appointmentId, appointment, queueNumber };
    });
    
    console.log('✅ Appointment booked successfully:', appointmentData.appointmentId);

    setQueueNumber(appointmentData.queueNumber);
    showToast('🎉 Appointment booked successfully!', 'success');

    if (onBookingComplete) {
      onBookingComplete();
    }

    fetch('/api/send-booking-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName: formData.fullName,
        patientEmail: userEmail,
        doctor: formData.doctor,
        appointmentDate: formData.appointmentDate,
        timeSlot: formData.timeSlot,
        queueNumber: appointmentData.queueNumber,
        priorityLevel: formData.priorityLevel
      }),
    }).catch(err => console.error('Background email failed:', err));

    setTimeout(() => {
      handleClose();
    }, 2000);
    
  } catch (error: unknown) {
    console.error('Error booking appointment:', error);
    
    if (error instanceof Error) {
      if (error.message === 'SLOT_TAKEN') {
        showToast('⚠️ This time slot was just booked by another user. Please choose another time.', 'warning');
        if (formData.doctor && formData.appointmentDate && formData.priorityLevel) {
          generateTimeSlots(formData.priorityLevel, formData.doctor, formData.appointmentDate);
        }
      } else if (error.message === 'DOCTOR_UNAVAILABLE') {
        showToast('⚠️ This doctor is no longer available on the selected date. Please choose another date.', 'warning');
      } else if (error.message === 'DOCTOR_FULLY_BOOKED') {
        showToast('⚠️ This doctor is now fully booked for the selected date. Please choose another doctor or date.', 'warning');
        if (formData.doctor && formData.appointmentDate && formData.priorityLevel) {
          generateTimeSlots(formData.priorityLevel, formData.doctor, formData.appointmentDate);
        }
      } else {
        console.error('Unexpected error:', error);
        showToast('Failed to book appointment. Please try again.', 'error');
      }
    } else {
      showToast('Failed to book appointment. Please try again.', 'error');
    }
  } finally {
    setIsSubmitting(false);
  }
};
  const handleClose = () => {
    setFormData({
      fullName: '',
      age: '',
      photo: '',
      doctor: '',
      appointmentDate: '',
      gender: '',
      medicalCondition: '',
      customCondition: '',
      phone: '',
      priorityLevel: 'normal',
      timeSlot: ''
    });
    setQueueNumber(null);
    setAvailableTimeSlots([]);
    setHasAvailableSlots(true);
    setIsCheckingAvailability(false);
    setIsDoctorUnavailable(false);
    setBookingEligibility(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        ></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full relative z-[101]">
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 id="modal-title" className="text-2xl font-bold text-white">
                {queueNumber ? 'Appointment Confirmed!' : 'Book Appointment'}
              </h3>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {queueNumber ? (
              <div className="text-center py-8">
                <div className="mb-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked Successfully!</h4>
                  <p className="text-gray-600 mb-4">Your queue number is:</p>
                  <div className="inline-block bg-blue-600 text-white text-4xl font-bold px-8 py-4 rounded-lg">
                    #{queueNumber}
                  </div>
                  <p className="text-gray-600 mt-4">Please arrive 30 minutes before your scheduled time.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
               {bookingEligibility && !bookingEligibility.canBook && (
            <div className={`mb-6 p-4 border-2 rounded-lg ${
              bookingEligibility.reason.includes('🚫') 
                ? 'bg-red-100 border-red-500 shadow-lg' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 ${
                  bookingEligibility.reason.includes('🚫') 
                    ? 'bg-red-500 p-2 rounded-full' 
                    : ''
                }`}>
                  <AlertCircle className={`w-6 h-6 ${
                    bookingEligibility.reason.includes('🚫') 
                      ? 'text-white' 
                      : 'text-red-600'
                  } flex-shrink-0 mt-0.5`} />
                </div>
                <div className="flex-1">
                  <h4 className={`text-lg font-bold mb-1 ${
                    bookingEligibility.reason.includes('🚫') 
                      ? 'text-red-900' 
                      : 'text-red-800'
                  }`}>
                    {bookingEligibility.reason.includes('🚫') ? 'Account Restricted' : 'Booking Restricted'}
                  </h4>
                  <p className={`text-sm ${
                    bookingEligibility.reason.includes('🚫') 
                      ? 'text-red-800 font-medium' 
                      : 'text-red-700'
                  }`}>
                    {bookingEligibility.reason}
                  </p>
                  {bookingEligibility.reason.includes('🚫') && (
                    <div className="mt-3 p-3 bg-white rounded border border-red-300">
                      <p className="text-xs text-gray-700">
                        <strong>Note:</strong> All booking functions are disabled while your account is restricted. 
                        This includes selecting time slots and submitting appointments.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500" aria-label="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                    aria-required="true"
                    autoComplete="name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
                      Age <span className="text-red-500" aria-label="required">*</span>
                    </label>
                    <input
                      type="number"
                      id="age"
                      name="age"
                      min="1"
                      max="150"
                      value={formData.age}
                      onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Age"
                      aria-required="true"
                      autoComplete="age"
                    />
                  </div>
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                      Gender <span className="text-red-500" aria-label="required">*</span>
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      aria-required="true"
                      autoComplete="sex"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Photo (Optional)
                  </label>
                  <div className="flex items-center justify-center">
                    {formData.photo ? (
                      <div className="relative">
                        <img
                          src={formData.photo}
                          alt="Profile preview"
                          className="w-32 h-32 rounded-lg object-cover border-2 border-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, photo: '' }))}
                          className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 transition border border-gray-200"
                          aria-label="Remove photo"
                        >
                          <X className="w-4 h-4 text-gray-600 hover:text-gray-800" />
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-2 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                          Change Photo
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition cursor-pointer ${
                          isDragOver 
                            ? 'border-blue-600 bg-blue-50' 
                            : 'border-gray-300 hover:border-blue-600 hover:bg-blue-50'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Upload photo area"
                      >
                        {isDragOver ? (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Upload className="w-8 h-8 text-blue-600 mb-2" aria-hidden="true" />
                            <span className="text-sm text-blue-600 font-medium">Drop image here</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Camera className="w-8 h-8 text-gray-400 mb-2" aria-hidden="true" />
                            <span className="text-sm text-gray-500">Click or drag & drop</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="photo"
                    name="photo"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                    aria-label="Photo upload input"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Click to browse or drag and drop an image 
                  </p>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500" aria-label="required">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">+63</span>
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={(e) => {
                        const numbersOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                        setFormData(prev => ({ ...prev, phone: numbersOnly }));
                      }}
                      onBlur={(e) => {
                        const phoneNumber = e.target.value;
                        if (phoneNumber && phoneNumber.length === 11) {
                          const isValidPH = phoneNumber.startsWith('09');
                          if (!isValidPH) {
                            showToast('Please enter a valid Philippine mobile number starting with 09 (e.g., 09123456789)', 'error');
                            setFormData(prev => ({ ...prev, phone: '' }));
                          }
                        }
                      }}
                      className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="912 345 6789"
                      aria-required="true"
                      maxLength={11}
                      pattern="[0-9]{11}"
                      title="Please enter a valid 11-digit Philippine mobile number (e.g., 09123456789)"
                      autoComplete="tel"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your 11-digit PH mobile number (e.g., 09123456789)
                  </p>
                  {formData.phone && formData.phone.length === 11 && !formData.phone.startsWith('09') && (
                    <p className="text-xs text-red-500 mt-1">
                      ❌ Must start with 09 for Philippine numbers
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="priorityLevel" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority Level <span className="text-red-500" aria-label="required">*</span>
                  </label>
                  <select
                    id="priorityLevel"
                    name="priorityLevel"
                    value={formData.priorityLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, priorityLevel: e.target.value, timeSlot: '' }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    aria-required="true"
                    autoComplete="off"
                  >
                    <option value="normal">🟢 Normal (1 hour slots - 2 per day max)</option>
                    <option value="urgent">🟡 Urgent (30 min buffer - 1 per day max)</option>
                    <option value="emergency">🔴 Emergency (15 min buffer - 1 per day max)</option>
                  </select>
                </div>

                {formData.priorityLevel && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-blue-800">
                      <Info className="w-4 h-4 flex-shrink-0" />
                      <div>
                        <span className="font-medium block">
                          {formData.priorityLevel === 'emergency' && '🔴 Emergency: 15-minute buffer slots'}
                          {formData.priorityLevel === 'urgent' && '🟡 Urgent: 30-minute buffer slots'}
                          {formData.priorityLevel === 'normal' && '🟢 Normal: 1-hour regular slots'}
                        </span>
                        <span className="text-xs text-blue-700 font-semibold mt-1 block">
                          Daily limit: {formData.priorityLevel === 'normal' ? '2' : '1'} {formData.priorityLevel} appointment{formData.priorityLevel === 'normal' ? 's' : ''} per day
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="doctor" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Doctor <span className="text-red-500" aria-label="required">*
                    </span>
                  </label>
                  <select
                    id="doctor"
                    name="doctor"
                    required
                    value={formData.doctor}
                    onChange={(e) => setFormData(prev => ({ ...prev, doctor: e.target.value, timeSlot: '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    aria-required="true"
                    autoComplete="off"
                  >
                    <option value="">Select Doctor</option>
                    {doctors.map(doctor => (
                      <option key={doctor.id} value={doctor.name}>
                        Dr. {doctor.name} - {doctor.specialty}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="appointmentDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Appointment Date <span className="text-red-500" aria-label="required">*</span>
                  </label>
                  <input
                    type="date"
                    id="appointmentDate"
                    name="appointmentDate"
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, appointmentDate: e.target.value, timeSlot: '' }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Select appointment date"
                    aria-required="true"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="timeSlot" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Time Slot <span className="text-red-500" aria-label="required">*</span>
                  </label>
                  
                  {formData.doctor && formData.appointmentDate && formData.priorityLevel && !isCheckingAvailability && (
                    (() => {
                      const availableSlotsCount = availableTimeSlots.filter(slot => 
                        slot.available && !slot.isBooked && !slot.isUnavailable
                      ).length;
                      const hasSlots = availableSlotsCount > 0;

                      if (isDoctorUnavailable) {
                        return (
                          <div className="mb-4 text-center py-6 border-2 border-red-300 rounded-lg bg-red-50">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <span className="text-2xl">⏸️</span>
                            </div>
                            <h4 className="text-lg font-bold text-red-800 mb-2">Doctor Unavailable</h4>
                            <p className="text-red-700 text-sm px-4">
                              Dr. {formData.doctor} is marked as unavailable on {new Date(formData.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}.
                            </p>
                          </div>
                        );
                      }

                      if (!hasAvailableSlots && !hasSlots) {
                        return (
                          <div className="mb-4 text-center py-6 border-2 border-orange-300 rounded-lg bg-orange-50">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <span className="text-2xl">⚠️</span>
                            </div>
                            <h4 className="text-lg font-bold text-orange-800 mb-2">No Available Time Slots</h4>
                            <p className="text-orange-700 text-sm mb-4 px-4">
                              Dr. {formData.doctor} is fully booked for {new Date(formData.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}.
                            </p>
                            
                            {(!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
                              !formData.medicalCondition ||
                              (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim())) && (
                              <div className="mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-blue-700 text-xs font-medium">
                                  📝 Please fill all required fields to join the waiting list
                                </p>
                              </div>
                            )}
                            
                            <div className="flex flex-col sm:flex-row gap-2 justify-center px-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    doctor: '', 
                                    appointmentDate: '', 
                                    timeSlot: '',
                                    priorityLevel: 'normal'
                                  }));
                                  setAvailableTimeSlots([]);
                                  setHasAvailableSlots(true);
                                }}
                                className="px-4 py-2 bg-white text-orange-700 border-2 border-orange-300 rounded-lg text-sm font-medium hover:bg-orange-50 transition"
                              >
                                📅 Choose Another Doctor/Date
                              </button>
                              <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const userEmail = auth.currentUser?.email;
                                  const userId = auth.currentUser?.uid;
                                  
                                  // Validate required fields
                                  if (!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
                                      !formData.medicalCondition || !formData.doctor || !formData.appointmentDate ||
                                      (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim())) {
                                    showToast('Please fill in all required fields before joining the waiting list.', 'warning');
                                    return;
                                  }

                                  console.log('🔄 Adding patient to waiting list...', {
                                    patient: formData.fullName,
                                    doctor: formData.doctor,
                                    date: formData.appointmentDate,
                                    email: userEmail
                                  });

                                  // Create waiting list entry with all required data
                                  const waitingListRef = collection(db, 'waitingList');
                                  const waitingListData = {
                                    fullName: formData.fullName,
                                    age: formData.age,
                                    photo: formData.photo || '',
                                    doctor: formData.doctor,
                                    appointmentDate: formData.appointmentDate,
                                    gender: formData.gender,
                                    medicalCondition: formData.medicalCondition === 'Other (Please Specify)' 
                                      ? formData.customCondition 
                                      : formData.medicalCondition,
                                    phone: formData.phone,
                                    email: userEmail || '',
                                    priorityLevel: formData.priorityLevel,
                                    preferredTimeSlot: formData.timeSlot || '',
                                    requestedDate: formData.appointmentDate,
                                    status: 'waiting',
                                    createdAt: new Date().toISOString(),
                                    patientId: userId || '',
                                    // Additional fields for better tracking
                                    lastUpdated: new Date().toISOString(),
                                    autoAssignAttempts: 0 // Track how many times auto-assignment was attempted
                                  };

                                  // Add to waiting list collection
                                  await addDoc(waitingListRef, waitingListData);
                                  
                                  console.log('✅ Successfully added to waiting list:', waitingListData);
                                  
                                  showToast('✅ You have been added to the waiting list! We will notify you when a slot becomes available.', 'success');
                                  
                                  // Close modal after successful addition
                                  setTimeout(() => {
                                    handleClose();
                                  }, 2000);
                                } catch (error) {
                                  console.error('❌ Error adding to waiting list:', error);
                                  console.error('Error details:', error);
                                  showToast('Failed to join waiting list. Please try again.', 'error');
                                }
                              }}
                              disabled={!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
                                        !formData.medicalCondition || !formData.doctor || !formData.appointmentDate ||
                                        (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim())}
                              className="px-4 py-2 bg-orange-600 text-white border-2 border-orange-600 rounded-lg text-sm font-medium hover:bg-orange-700 transition disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                            >
                              📋 Join Waiting List
                            </button>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()
                  )}

                  {formData.doctor && formData.appointmentDate && formData.priorityLevel ? (
                    (() => {
                      const isLoading = isCheckingAvailability;
                      const availableSlotsCount = availableTimeSlots.filter(slot => 
                        slot.available && !slot.isBooked && !slot.isUnavailable
                      ).length;
                      const hasSlots = availableSlotsCount > 0;

                      if (isLoading) {
                        return (
                          <div className="text-center py-8 border-2 border-gray-200 rounded-lg bg-gray-50">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <h4 className="text-xl font-bold text-gray-700 mb-2">Checking availability...</h4>
                            <p className="text-gray-600">Please wait while we load available time slots.</p>
                          </div>
                        );
                      }

                      if (isDoctorUnavailable || (!hasAvailableSlots && !hasSlots)) {
                        return (
                          <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                            <p className="text-gray-500">Please see the message above and choose another option.</p>
                          </div>
                        );
                      }

                      if (availableTimeSlots.length > 0) {
                        return (
                   <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg" role="group" aria-label="Time slot selection">
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
                      if (slot.isBuffer && slot.bufferType === 'emergency') {
                        buttonClasses += 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100 cursor-pointer';
                      } else if (slot.isBuffer && slot.bufferType === 'urgent') {
                        buttonClasses += 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100 cursor-pointer';
                      } else {
                        buttonClasses += 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100 cursor-pointer';
                      }
                      statusLabel = 'Available';
                      statusLabelClasses = 'text-xs mt-1 px-2 py-0.5 rounded-full bg-white bg-opacity-70';
                    } else {
                      buttonClasses += 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed opacity-60';
                      statusLabel = 'Unavailable';
                      statusLabelClasses = 'text-xs mt-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-600';
                    }
                    
                    if (formData.timeSlot === slot.time && isAvailable && !isUserRestricted) {
                      buttonClasses += ' ring-2 ring-blue-500 ring-offset-2';
                    }
                    
                    return (
                     <button
                      key={slot.time}
                      type="button"
                      onClick={() => {
                        if (isAvailable && !isUserRestricted) {
                          setFormData(prev => ({ ...prev, timeSlot: slot.time }));
                        }
                      }}
                      disabled={!isAvailable || !!isUserRestricted}
                      className={buttonClasses}
                      aria-pressed={formData.timeSlot === slot.time ? "true" : "false"}
                      aria-disabled={!isAvailable || !!isUserRestricted}
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
                          <span className="text-xs mt-1 text-yellow-600 font-semibold">Urgent</span>
                        )}
                      </div>
                    </button>
                    );
                  })}
                </div>
                        );
                      }
                      
                      return (
                        <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                          <p className="text-gray-500">Unable to load time slots. Please try again.</p>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                      <p className="text-gray-500">Please select a doctor, date, and priority level to view available time slots.</p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="medicalCondition" className="block text-sm font-medium text-gray-700 mb-2">
                    Eye Condition <span className="text-red-500" aria-label="required">*</span>
                  </label>
                  <select
                    id="medicalCondition"
                    name="medicalCondition"
                    value={formData.medicalCondition}
                    onChange={(e) => setFormData(prev => ({ ...prev, medicalCondition: e.target.value, customCondition: '' }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    aria-required="true"
                    autoComplete="off"
                  >
                    <option value="">Select your eye condition</option>
                    {eyeConditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.medicalCondition === 'Other (Please Specify)' && (
                  <div>
                    <label htmlFor="customCondition" className="block text-sm font-medium text-gray-700 mb-2">
                      Please Specify Your Condition <span className="text-red-500" aria-label="required">*</span>
                    </label>
                    <textarea
                      id="customCondition"
                      name="customCondition"
                      value={formData.customCondition}
                      onChange={(e) => setFormData(prev => ({ ...prev, customCondition: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe your eye condition or reason for visit"
                      aria-required="true"
                      autoComplete="off"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    !formData.timeSlot || 
                    isSubmitting || 
                    (bookingEligibility !== null && !bookingEligibility.canBook)
                  }
                  className={`flex-1 px-6 py-3 rounded-lg font-medium transition ${
                    bookingEligibility && !bookingEligibility.canBook && bookingEligibility.reason.includes('🚫')
                      ? 'bg-gray-400 text-gray-700 cursor-not-allowed opacity-50'
                      : 'bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed'
                  }`}
                  title={
                    bookingEligibility && !bookingEligibility.canBook && bookingEligibility.reason.includes('🚫')
                      ? 'Your account is restricted from booking'
                      : ''
                  }
                >
                  {isSubmitting 
                    ? 'Booking...' 
                    : (bookingEligibility && !bookingEligibility.canBook && bookingEligibility.reason.includes('🚫')
                        ? '🚫 Booking Disabled'
                        : 'Book Appointment'
                      )
                  }
                </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && toast.show && (
        <div className="fixed top-4 right-4 z-[200] max-w-md w-full">
          <div className={`
            flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-orange-500 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
            animate-in slide-in-from-right-full
          `}>
            {toast.type === 'success' && <CheckCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'warning' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-6 h-6 flex-shrink-0" />}
            <p className="font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-80 transition flex-shrink-0"
              aria-label="Close notification"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px white inset !important;
          -webkit-text-fill-color: #374151 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
    </div>
  );
};

export default AppointmentModal;