import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, runTransaction } from 'firebase/firestore';
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

  // Add Toast state
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

  const recalculateQueueNumbers = async (appointmentDate: string) => {
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('appointmentDate', '==', appointmentDate)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return;
      
      const appointments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        timeSlot: doc.data().timeSlot as string
      }));
      
      appointments.sort((a, b) => {
        const [hoursA, minutesA] = a.timeSlot.split(':').map(Number);
        const [hoursB, minutesB] = b.timeSlot.split(':').map(Number);
        const timeA = hoursA * 60 + minutesA;
        const timeB = hoursB * 60 + minutesB;
        return timeA - timeB;
      });
      
      const updatePromises = appointments.map((apt, index) => {
        const appointmentRef = doc(db, 'appointments', apt.id);
        return updateDoc(appointmentRef, {
          queueNumber: index + 1
        });
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error recalculating queue numbers:', error);
    }
  };

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getBookedTimeSlots = useCallback(async (doctor: string, appointmentDate: string): Promise<string[]> => {
    if (!doctor || !appointmentDate) return [];
    
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('doctor', '==', doctor),
        where('appointmentDate', '==', appointmentDate),
        where('status', '!=', 'cancelled')
      );
      
      const querySnapshot = await getDocs(q);
      const bookedSlots = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📌 Booked appointment found:', {
          doctor: data.doctor,
          date: data.appointmentDate,
          timeSlot: data.timeSlot,
          status: data.status
        });
        return data.timeSlot as string;
      });
      
      console.log('📋 Total booked slots for', doctor, 'on', appointmentDate, ':', bookedSlots);
      return bookedSlots;
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
      
      if (doctorSnapshot.empty) return {isFullyBooked: false, isUnavailable: false};
      
      const doctorData = doctorSnapshot.docs[0].data();
      
      const unavailableDates = doctorData.unavailableDates || {};
      if (unavailableDates[appointmentDate] === true) {
        console.log('🚫 Doctor is marked as unavailable on this date');
        return {isFullyBooked: false, isUnavailable: true};
      }
      
      const maxSlotsPerDate = doctorData.maxSlotsPerDate || {};
      const dateSpecificMaxSlots = maxSlotsPerDate[appointmentDate];
      const globalMaxSlots = doctorData.maxSlots || 10;
      const maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;
      
      console.log('📊 Max slots for this date:', maxSlots);
      
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('doctor', '==', doctor),
        where('appointmentDate', '==', appointmentDate),
        where('status', '!=', 'cancelled')
      );
      
      const querySnapshot = await getDocs(q);
      const bookedCount = querySnapshot.size;
      
      console.log('📋 Current booked appointments:', bookedCount);
      console.log('🔍 Is fully booked?', bookedCount >= maxSlots);
      
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
    setIsDoctorUnavailable(true); // ✅ ADD THIS LINE
    setIsCheckingAvailability(false);
    return;
  }
  
  // ✅ ADD THIS LINE - Reset unavailable state if doctor is available
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

  console.log(`✅ Generated ${slots.length} total slots`);
  console.log(`✅ Actually available slots: ${actuallyAvailableSlots.length}`);
  console.log(`✅ Booked slots: ${slots.filter(s => s.isBooked).length}`);
  console.log(`✅ Unavailable slots: ${slots.filter(s => s.isUnavailable).length}`);
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
    setIsDoctorUnavailable(false); // ✅ ADD THIS LINE - Reset when clearing form
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

 const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    // ✅ REMOVED FILE SIZE LIMIT - Only validate file type
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

    const reader = new FileReader();
    
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        // ✅ KEPT DIMENSION CONSTRAINTS for display optimization
        const maxWidth = 2048;
        const maxHeight = 2048;
        
        let width = img.width;
        let height = img.height;

        // Only scale if necessary for display
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 for display (not stored in database)
        let processedDataUrl;
        if (file.type === 'image/png' || file.type === 'image/gif') {
          processedDataUrl = canvas.toDataURL('image/png');
        } else if (file.type === 'image/webp') {
          processedDataUrl = canvas.toDataURL('image/webp', 0.95);
        } else {
          processedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        }
        
        setFormData(prev => ({ ...prev, photo: processedDataUrl }));
        
        console.log('🖼️ Image processed for display:', {
          originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          originalDimensions: `${img.width}x${img.height}`,
          displayDimensions: `${width}x${height}`,
          format: file.type
        });
      };
      
      img.src = reader.result as string;
    };
    
    reader.onerror = () => {
      showToast('Error reading file. Please try again.', 'error');
    };
    
    reader.readAsDataURL(file);
  }
};  const handleSubmit = async () => {
    if (!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
        !formData.doctor || !formData.appointmentDate || !formData.timeSlot || !formData.medicalCondition) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    if (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim()) {
      showToast('Please specify your medical condition', 'warning');
      return;
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

      // 🔒 TRANSACTION: Atomic check and book operation with queue number generation
      const appointmentData = await runTransaction(db, async (transaction) => {
        // ✅ Step 1: Create unique slot document reference for atomic locking
        const slotLockRef = doc(db, 'slot_locks', `${formData.doctor}_${formData.appointmentDate}_${formData.timeSlot}`);
        
        // Try to read the slot lock - this will fail if slot is taken
        const slotLockDoc = await transaction.get(slotLockRef);
        
        if (slotLockDoc.exists()) {
          throw new Error('SLOT_TAKEN');
        }
        
        // ✅ Step 2: Check doctor availability and capacity
        const doctorsRef = collection(db, 'doctors');
        const doctorQuery = query(doctorsRef, where('name', '==', formData.doctor));
        const doctorSnapshot = await getDocs(doctorQuery);
        
        let maxSlots = 10;
        
        if (!doctorSnapshot.empty) {
          const doctorDocRef = doc(db, 'doctors', doctorSnapshot.docs[0].id);
          const doctorDoc = await transaction.get(doctorDocRef);
          const doctorData = doctorDoc.data();
          
          if (doctorData) {
            // Check unavailable dates
            const unavailableDates = doctorData.unavailableDates || {};
            if (unavailableDates[formData.appointmentDate] === true) {
              throw new Error('DOCTOR_UNAVAILABLE');
            }
            
            // Get max slots
            const maxSlotsPerDate = doctorData.maxSlotsPerDate || {};
            const dateSpecificMaxSlots = maxSlotsPerDate[formData.appointmentDate];
            const globalMaxSlots = doctorData.maxSlots || 10;
            maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;
          }
        }
        
        // ✅ Step 3: Get all appointments for queue number calculation (read within transaction)
        const appointmentsRef = collection(db, 'appointments');
        const appointmentsQuery = query(
          appointmentsRef,
          where('doctor', '==', formData.doctor),
          where('appointmentDate', '==', formData.appointmentDate),
          where('status', '!=', 'cancelled')
        );
        
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const activeBookingsCount = appointmentsSnapshot.size;
        
        // Check if doctor is fully booked
        if (activeBookingsCount >= maxSlots) {
          throw new Error('DOCTOR_FULLY_BOOKED');
        }
        
        // ✅ Step 4: Calculate queue number based on time slot order
        const existingAppointments = appointmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          timeSlot: doc.data().timeSlot as string
        }));
        
        // Add current time slot to the list for proper sorting
        existingAppointments.push({
          id: 'current',
          timeSlot: formData.timeSlot
        });
        
        // Sort by time slot
        existingAppointments.sort((a, b) => {
          const [hoursA, minutesA] = a.timeSlot.split(':').map(Number);
          const [hoursB, minutesB] = b.timeSlot.split(':').map(Number);
          const timeA = hoursA * 60 + minutesA;
          const timeB = hoursB * 60 + minutesB;
          return timeA - timeB;
        });
        
        // Find the queue number for current appointment
        const queueNumber = existingAppointments.findIndex(apt => apt.id === 'current') + 1;
        
        // ✅ Step 5: Create the appointment with correct queue number
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

        // Create new document reference
        const newAppointmentRef = doc(collection(db, 'appointments'));
        
        // Set the appointment document in the transaction
        transaction.set(newAppointmentRef, appointment);
        
        // Set the slot lock in the transaction to prevent concurrent bookings
        transaction.set(slotLockRef, {
          doctor: formData.doctor,
          appointmentDate: formData.appointmentDate,
          timeSlot: formData.timeSlot,
          appointmentId: newAppointmentRef.id,
          bookedAt: new Date().toISOString()
        });
        
        return { appointmentId: newAppointmentRef.id, appointment, queueNumber };
      });

      console.log('✅ Appointment booked successfully via transaction:', appointmentData.appointmentId);
      console.log('✅ Queue number assigned:', appointmentData.queueNumber);

      // Recalculate queue numbers for all other appointments on this date
      await recalculateQueueNumbers(formData.appointmentDate);

      // Send email notification to clinic
      try {
        const response = await fetch('/api/send-booking-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patientName: formData.fullName,
            patientEmail: userEmail,
            doctor: formData.doctor,
            appointmentDate: formData.appointmentDate,
            timeSlot: formData.timeSlot,
            queueNumber: appointmentData.queueNumber,
            priorityLevel: formData.priorityLevel
          }),
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
          console.error('Failed to send booking notification:', data.error);
          // Don't fail the booking if email fails
        } else {
          console.log('✅ Booking notification sent to clinic');
        }
      } catch (emailError) {
        console.error('Error sending booking notification:', emailError);
        // Don't fail the booking if email fails
      }

      // Set the queue number for display
      setQueueNumber(appointmentData.queueNumber);

      // Show success toast notification
      showToast('🎉 Appointment booked successfully!', 'success');

      // Call onBookingComplete if provided
      if (onBookingComplete) {
        onBookingComplete();
      }

      setTimeout(() => {
        handleClose();
      }, 2000);
      
    } catch (error: unknown) {
      console.error('Error booking appointment:', error);
      
      // Handle specific error cases with toast notifications
      if (error instanceof Error) {
        if (error.message === 'SLOT_TAKEN') {
          showToast('⚠️ This time slot was just booked by another user. Please refresh and choose another time.', 'warning');
          // Refresh available slots
          if (formData.doctor && formData.appointmentDate && formData.priorityLevel) {
            await generateTimeSlots(formData.priorityLevel, formData.doctor, formData.appointmentDate);
          }
        } else if (error.message === 'DOCTOR_UNAVAILABLE') {
          showToast('⚠️ This doctor is no longer available on the selected date. Please choose another date.', 'warning');
        } else if (error.message === 'DOCTOR_FULLY_BOOKED') {
          showToast('⚠️ This doctor is now fully booked for the selected date. Please choose another doctor or date.', 'warning');
          // Refresh available slots
          if (formData.doctor && formData.appointmentDate && formData.priorityLevel) {
            await generateTimeSlots(formData.priorityLevel, formData.doctor, formData.appointmentDate);
          }
        } else {
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
                  <p className="text-gray-600 mt-4">Please arrive 15 minutes before your scheduled time.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
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
                        {/* X Remove Button */}
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
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        aria-label="Upload photo"
                      >
                        <Camera className="w-8 h-8 text-gray-400 mb-2" aria-hidden="true" />
                        <span className="text-sm text-gray-500">Upload Photo</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="photo"
                    name="photo"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    aria-label="Photo upload input"
                  />
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
                    <option value="normal">Normal (1 hour slots)</option>
                    <option value="urgent">Urgent (30 minute buffer slots)</option>
                    <option value="emergery">Emergency (15 minute buffer slots)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="doctor" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Doctor <span className="text-red-500" aria-label="required">*</span>
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
                    aria-required="true"
                    autoComplete="off"
                  />
                </div>
                <div>
                <label htmlFor="timeSlot" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Time Slot <span className="text-red-500" aria-label="required">*</span>
                </label>
                {formData.doctor && formData.appointmentDate && formData.priorityLevel ? (
                  (() => {
                    const isLoading = isCheckingAvailability;
                    const availableSlotsCount = availableTimeSlots.filter(slot => 
                      slot.available && !slot.isBooked && !slot.isUnavailable
                    ).length;
                    const hasSlots = availableSlotsCount > 0;
                    console.log(`🎯 UI Render Check - Loading: ${isLoading}, Available slots: ${availableSlotsCount}, Total slots: ${availableTimeSlots.length}, hasAvailableSlots: ${hasAvailableSlots}, hasSlots: ${hasSlots}, Doctor Unavailable: ${isDoctorUnavailable}`);

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

                    // ✅ UPDATED - Use state variable instead of async call
                    if (isDoctorUnavailable) {
                      return (
                        <div className="text-center py-8 border-2 border-red-300 rounded-lg bg-red-50">
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⏸️</span>
                          </div>
                          <h4 className="text-xl font-bold text-red-800 mb-2">Doctor Unavailable</h4>
                          <p className="text-red-700 mb-4 px-4">
                            Dr. {formData.doctor} is marked as unavailable on {new Date(formData.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}.
                          </p>
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mx-4 mb-4">
                            <div className="flex items-start gap-3">
                              <Info className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                              <div className="text-left">
                                <p className="text-yellow-800 font-medium mb-1">Reminder:</p>
                                <p className="text-yellow-700 text-sm">
                                  This doctor has been marked as unavailable by staff. Please select another doctor or date for your appointment.
                                </p>
                              </div>
                            </div>
                          </div>
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
                              setIsDoctorUnavailable(false); // ✅ ADD THIS - Reset state
                            }}
                            className="px-6 py-3 bg-white text-red-700 border-2 border-red-300 rounded-lg font-medium hover:bg-red-50 transition"
                          >
                            📅 Choose Another Doctor/Date
                          </button>
                        </div>
                      );
                    }
                      if (!hasAvailableSlots && !hasSlots) {
                        return (
                          <div className="text-center py-8 border-2 border-orange-300 rounded-lg bg-orange-50">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <span className="text-3xl">⚠️</span>
                            </div>
                            <h4 className="text-xl font-bold text-orange-800 mb-2">No available time slots.</h4>
                            <p className="text-orange-700 mb-6 px-4">
                              {formData.doctor} is fully booked for {new Date(formData.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}. Please select another doctor or date, or join the waiting list.
                            </p>
                            
                            {(!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
                              !formData.doctor || !formData.appointmentDate || !formData.medicalCondition ||
                              (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim())) && (
                              <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-blue-700 text-sm font-medium">
                                  📝 Please fill all the fields to join the waiting list, and we'll let you know when a slot has opened up.
                                </p>
                              </div>
                            )}
                            
                            <div className="flex flex-col sm:flex-row gap-3 justify-center px-4">
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
                                className="px-6 py-3 bg-white text-orange-700 border-2 border-orange-300 rounded-lg font-medium hover:bg-orange-50 transition"
                              >
                                📅 Choose Another Doctor/Date
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const waitingListRef = collection(db, 'waitingList');
                                    await addDoc(waitingListRef, {
                                      fullName: formData.fullName || '',
                                      age: formData.age || '',
                                      photo: formData.photo || '',
                                      doctor: formData.doctor,
                                      appointmentDate: formData.appointmentDate,
                                      gender: formData.gender || '',
                                      medicalCondition: formData.medicalCondition || '',
                                      phone: formData.phone || '',
                                      priorityLevel: formData.priorityLevel,
                                      preferredTimeSlot: formData.timeSlot || '',
                                      requestedDate: formData.appointmentDate,
                                      status: 'waiting',
                                      createdAt: new Date().toISOString()
                                    });
                                    
                                    showToast('✅ You have been added to the waiting list! We will notify you when a slot becomes available.', 'success');
                                    handleClose();
                                  } catch (error) {
                                    console.error('Error adding to waiting list:', error);
                                    showToast('Failed to join waiting list. Please try again.', 'error');
                                  }
                                }}
                                disabled={!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
                                          !formData.doctor || !formData.appointmentDate || !formData.medicalCondition ||
                                          (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim())}
                                className="px-6 py-3 bg-orange-600 text-white border-2 border-orange-600 rounded-lg font-medium hover:bg-orange-700 transition disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                              >
                                📋 Join Waiting List
                              </button>
                            </div>
                          </div>
                        );
                      }
  

                      if (availableTimeSlots.length > 0) {
                        return (
                          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg" role="group" aria-label="Time slot selection">
                            {availableTimeSlots.map((slot) => {
                              const isAvailable = slot.available && !slot.isBooked && !slot.isUnavailable;
                              const isBooked = slot.isBooked;
                              const isUnavailable = slot.isUnavailable && !slot.isBooked;
                              
                              let buttonClasses = 'px-3 py-3 rounded-lg text-sm font-medium transition border-2 ';
                              let statusLabel = '';
                              let statusLabelClasses = '';
                              
                              if (isBooked) {
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
                              
                              if (formData.timeSlot === slot.time && isAvailable) {
                                buttonClasses += ' ring-2 ring-blue-500 ring-offset-2';
                              }
                              
                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  onClick={() => {
                                    if (isAvailable) {
                                      setFormData(prev => ({ ...prev, timeSlot: slot.time }));
                                    }
                                  }}
                                  disabled={!isAvailable}
                                  className={buttonClasses}
                                  aria-pressed={formData.timeSlot === slot.time ? "true" : "false"}
                                  aria-disabled={!isAvailable}
                                >
                                  <div className="flex flex-col items-center">
                                    <span className="font-semibold">{convertTo12Hour(slot.time)}</span>
                                    <span className={statusLabelClasses}>
                                      {statusLabel}
                                    </span>
                                    {slot.isBuffer && slot.bufferType === 'emergency' && isAvailable && (
                                      <span className="text-xs mt-1 text-red-600 font-semibold">Emergency</span>
                                    )}
                                    {slot.isBuffer && slot.bufferType === 'urgent' && isAvailable && (
                                      <span className="text-xs mt-1 text-orange-600 font-semibold">Urgent</span>
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
                    disabled={!formData.timeSlot || isSubmitting}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Booking...' : 'Book Appointment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification for race condition to avoid double booking */}
        {toast && toast.show && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] p-4">
          <div className={`
            flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg max-w-md mx-auto
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-red-600 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
          `}>
            {toast.type === 'success' && <CheckCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'warning' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-6 h-6 flex-shrink-0" />}
            <p className="font-medium">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="ml-auto hover:opacity-80 transition"
              aria-label="Close notification"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Fix autofill white background issue */}
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