import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Info, Upload } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';

interface StaffBookAppointmentProps {
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
  bookedByStaff?: boolean;
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

const StaffBookAppointment = ({ isOpen, onClose, preFilledData, onBookingComplete }: StaffBookAppointmentProps) => {
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
    email: '',
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
      showToast('Failed to load doctors. Please try again.', 'error');
    }
  }, [showToast]); 

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);
  
  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getBookedTimeSlots = useCallback(async (doctor: string, appointmentDate: string): Promise<string[]> => {
    if (!doctor || !appointmentDate) return [];
    
    try {
      const appointmentsRef = collection(db, 'staff_appointments');
      const q = query(
        appointmentsRef,
        where('doctor', '==', doctor),
        where('appointmentDate', '==', appointmentDate),
        where('status', '!=', 'cancelled')
      );
      
      const querySnapshot = await getDocs(q);
      const bookedSlots = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return data.timeSlot as string;
      });
      
      const slotLocksRef = collection(db, 'slot_locks');
      const locksQuery = query(
        slotLocksRef,
        where('doctor', '==', doctor),
        where('appointmentDate', '==', appointmentDate)
      );
      
      const locksSnapshot = await getDocs(locksQuery);
      const lockedSlots = locksSnapshot.docs.map(doc => {
        const data = doc.data();
        return data.timeSlot as string;
      });
      
      const allBookedSlots = [...new Set([...bookedSlots, ...lockedSlots])];
      
      return allBookedSlots;
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
      return {isFullyBooked: false, isUnavailable: true};
    }
    
    const maxSlotsPerDate = doctorData.maxSlotsPerDate || {};
    const dateSpecificMaxSlots = maxSlotsPerDate[appointmentDate];
    const globalMaxSlots = doctorData.maxSlots || 10;
    const maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;
    
    if (maxSlots === 0) {
      return {isFullyBooked: true, isUnavailable: false};
    }
    
    // ✅ FIXED: Count ONLY from patient_appointments (primary collection) to avoid double-counting
    const appointmentsRef = collection(db, 'patient_appointments');
    const q = query(
      appointmentsRef,
      where('doctor', '==', doctor),
      where('appointmentDate', '==', appointmentDate),
      where('status', 'in', ['pending', 'confirmed', 'scheduled'])
    );
    
    const querySnapshot = await getDocs(q);
    const bookedCount = querySnapshot.size;
    
    console.log('📋 Staff: Current booked appointments (from primary collection):', bookedCount);
    console.log('🔍 Staff: Is fully booked?', bookedCount >= maxSlots, `(${bookedCount} >= ${maxSlots})`);
    
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
    
    return appointmentDateTime <= bufferTime;
  };

  const generateTimeSlots = useCallback(async (priorityLevel: string, doctor: string, appointmentDate: string) => {
    setIsCheckingAvailability(true);
    
    const {isFullyBooked, isUnavailable} = await isDoctorFullyBooked(doctor, appointmentDate);
    
    if (isUnavailable) {
      setAvailableTimeSlots([]);
      setHasAvailableSlots(false);
      setIsDoctorUnavailable(true);
      setIsCheckingAvailability(false);
      return;
    }
    
    setIsDoctorUnavailable(false);
    
    if (isFullyBooked) {
      setAvailableTimeSlots([]);
      setHasAvailableSlots(false);
      setIsCheckingAvailability(false);
      return;
    }
    
    const slots: TimeSlot[] = [];
    const startHour = 8;
    const endHour = 17;
    
    const bookedSlots = await getBookedTimeSlots(doctor, appointmentDate);
    
    const doctorsRef = collection(db, 'doctors');
    const doctorQuery = query(doctorsRef, where('name', '==', doctor));
    const doctorSnapshot = await getDocs(doctorQuery);
    
    let unavailableTimeSlots: string[] = [];
    
    if (!doctorSnapshot.empty) {
      const doctorData = doctorSnapshot.docs[0].data();
      unavailableTimeSlots = doctorData.availableSlots?.[appointmentDate] || [];
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
      }
    }

    const actuallyAvailableSlots = slots.filter(slot => 
      slot.available && !slot.isBooked && !slot.isUnavailable
    );
    const anyAvailable = actuallyAvailableSlots.length > 0;

    setHasAvailableSlots(anyAvailable);
    setAvailableTimeSlots(slots);
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
      showToast('Please upload a valid image file.', 'error');
      return;
    }

    try {
      const tempReader = new FileReader();
      tempReader.onloadend = () => {
        const tempPhotoUrl = tempReader.result as string;
        setFormData(prev => ({ ...prev, photo: tempPhotoUrl }));
      };
      tempReader.readAsDataURL(file);

      const compressedBase64 = await compressImageForDisplay(file);
      setFormData(prev => ({ ...prev, photo: compressedBase64 }));
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
  // Basic validation only
  if (!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
      !formData.email || !formData.doctor || !formData.appointmentDate || 
      !formData.timeSlot || !formData.medicalCondition) {
    showToast('Please fill in all required fields', 'warning');
    return;
  }

  if (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim()) {
    showToast('Please specify the medical condition', 'warning');
    return;
  }

  // STAFF: NO BOOKING RESTRICTIONS - Staff can book freely

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
    let doctorDocId = '';

    if (!doctorSnapshot.empty) {
      doctorDocId = doctorSnapshot.docs[0].id;
      const latestDoctorData = doctorSnapshot.docs[0].data();
      const maxSlotsPerDate = latestDoctorData.maxSlotsPerDate || {};
      const dateSpecificMaxSlots = maxSlotsPerDate[formData.appointmentDate];
      const globalMaxSlots = latestDoctorData.maxSlots || 10;
      
      // Use date-specific slots if they exist (even if 0), otherwise use global
      maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;

      console.log('🔧 STAFF CRITICAL: Fetched LATEST max slots for booking check:', {
        doctor: formData.doctor,
        date: formData.appointmentDate,
        dateSpecificMaxSlots: dateSpecificMaxSlots,
        globalMaxSlots: globalMaxSlots,
        finalMaxSlots: maxSlots,
        maxSlotsPerDate: maxSlotsPerDate,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ STAFF: Doctor not found in database:', formData.doctor);
      throw new Error('DOCTOR_NOT_FOUND');
    }

    // ✅ Check if max slots is 0 (completely blocked)
    if (maxSlots === 0) {
      console.log('🚫 STAFF: Max slots is 0 - doctor is fully booked for this date');
      throw new Error('DOCTOR_FULLY_BOOKED');
    }

    // ✅ Pre-fetch appointment IDs BEFORE transaction
    const patientRef = collection(db, 'patient_appointments');
    const patientQuery = query(
      patientRef,
      where('doctor', '==', formData.doctor),
      where('appointmentDate', '==', formData.appointmentDate),
      where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
    );
    
    const preFetchSnapshot = await getDocs(patientQuery);
    const appointmentIds = preFetchSnapshot.docs.map(d => d.id);

    // ✅ CRITICAL FIX: Use transaction.get() for ALL reads inside transaction
    const appointmentData = await runTransaction(db, async (transaction) => {
      const slotLockRef = doc(db, 'slot_locks', `${formData.doctor}_${formData.appointmentDate}_${formData.timeSlot}`);
      const slotLockDoc = await transaction.get(slotLockRef);
      
      if (slotLockDoc.exists()) {
        throw new Error('SLOT_TAKEN');
      }

      // ✅ FIXED: Use transaction.get() to read doctor document
      if (!doctorDocId) {
        throw new Error('DOCTOR_NOT_FOUND');
      }

      const doctorDocRef = doc(db, 'doctors', doctorDocId);
      const transactionDoctorDoc = await transaction.get(doctorDocRef);

      let transactionMaxSlots = 10; // Default fallback

      if (transactionDoctorDoc.exists()) {
        const transactionDoctorData = transactionDoctorDoc.data();
        const maxSlotsPerDate = transactionDoctorData?.maxSlotsPerDate || {};
        const dateSpecificMaxSlots = maxSlotsPerDate[formData.appointmentDate];
        const globalMaxSlots = transactionDoctorData?.maxSlots || 10;
        
        transactionMaxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : globalMaxSlots;
        
        console.log('🔍 STAFF TRANSACTION: Using FRESH max slots:', {
          doctor: formData.doctor,
          date: formData.appointmentDate,
          dateSpecificMaxSlots: dateSpecificMaxSlots,
          globalMaxSlots: globalMaxSlots,
          finalMaxSlots: transactionMaxSlots,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error('❌ STAFF TRANSACTION: Doctor document not found');
        throw new Error('DOCTOR_NOT_FOUND');
      }

      // ✅ FIXED: Read all appointments inside transaction using pre-fetched IDs
      const appointmentRefs = appointmentIds.map(id => doc(db, 'patient_appointments', id));
      
      // ✅ Read all appointments inside transaction
      const appointmentDocs = await Promise.all(
        appointmentRefs.map(ref => transaction.get(ref))
      );
      
      // Filter out cancelled appointments and count active ones
      const activeAppointments = appointmentDocs.filter(docSnapshot => {
        if (!docSnapshot.exists()) return false;
        const data = docSnapshot.data();
        const status = data?.status;
        return status === 'pending' || status === 'confirmed' || status === 'scheduled' || status === 'serving';
      });

      const currentBookedCount = activeAppointments.length;
      console.log('📊 STAFF TRANSACTION: Current booked count (verified in transaction):', currentBookedCount, 'Max slots:', transactionMaxSlots);
      
      if (currentBookedCount >= transactionMaxSlots) {
        console.log('🚫 Staff Transaction: Doctor fully booked - cannot add new appointment');
        throw new Error('DOCTOR_FULLY_BOOKED');
      }
     
      // Get all existing appointments with their time slots
      const allExistingAppointments = activeAppointments.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id, 
          timeSlot: data?.timeSlot as string, 
          queueNumber: data?.queueNumber as number,
          collection: 'patient_appointments' as const
        };
      });

      // Add the NEW appointment
      const allAppointments = [
        ...allExistingAppointments,
        {
          id: 'NEW_APPOINTMENT',
          timeSlot: formData.timeSlot,
          queueNumber: 0, // Will be calculated
          collection: 'staff_appointments' as const
        }
      ];

      // Sort ALL appointments by time slot ONCE
      allAppointments.sort((a, b) => {
        const timeA = a.timeSlot.split(':').map(Number);
        const timeB = b.timeSlot.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
      });

      console.log('\n🎯 ===== STAFF: QUEUE ASSIGNMENT (SORTED BY TIME) =====');
      allAppointments.forEach((apt, idx) => {
        console.log(`  Position ${idx + 1}: ${apt.timeSlot} - ${apt.id === 'NEW_APPOINTMENT' ? '🆕 NEW' : `ID: ${apt.id}`}`);
      });
      console.log('======================================================\n');

      // Reassign ALL queue numbers sequentially 1, 2, 3, 4... based ONLY on time order
      let queueNumber = 0;
      
      interface AppointmentUpdate {
        docRef: ReturnType<typeof doc>;
        appointmentId: string;
        newQueueNumber: number;
      }
      
      const appointmentsToUpdate: AppointmentUpdate[] = [];

      for (let i = 0; i < allAppointments.length; i++) {
        const appointment = allAppointments[i];
        const correctQueueNum = i + 1; // Sequential: 1, 2, 3, 4...
        
        if (appointment.id === 'NEW_APPOINTMENT') {
          queueNumber = correctQueueNum;
          console.log(`✅ STAFF: NEW appointment gets queue #${queueNumber} at ${appointment.timeSlot}`);
        } else if (appointment.queueNumber !== correctQueueNum) {
          const patientDocRef = doc(db, 'patient_appointments', appointment.id);
          appointmentsToUpdate.push({
            docRef: patientDocRef,
            appointmentId: appointment.id,
            newQueueNumber: correctQueueNum
          });
          console.log(`🔄 STAFF: Updating ${appointment.id}: #${appointment.queueNumber} → #${correctQueueNum} (${appointment.timeSlot})`);
        }
      }

      console.log(`\n📊 STAFF: Final ${allAppointments.length} appointments with queue numbers 1-${allAppointments.length}\n`);

      // ✅ Update existing appointments in BOTH collections using transaction
      for (const update of appointmentsToUpdate) {
        try {
          const patientDoc = await transaction.get(update.docRef);
          if (patientDoc.exists()) {
            const currentData = patientDoc.data();
            const staffDocRef = doc(db, 'staff_appointments', update.appointmentId);
            
            // Update both collections
            transaction.update(update.docRef, { queueNumber: update.newQueueNumber });
            transaction.set(staffDocRef, { 
              ...(currentData || {}), 
              queueNumber: update.newQueueNumber 
            }, { merge: true });
            
            console.log(`✅ STAFF: Updated queue #${update.newQueueNumber} for appointment ${update.appointmentId}`);
          }
        } catch (error) {
          console.error(`❌ STAFF: Failed to update queue for appointment ${update.appointmentId}:`, error);
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
        email: formData.email,
        priorityLevel: formData.priorityLevel,
        timeSlot: formData.timeSlot,
        queueNumber: queueNumber,
        status: 'pending',
        createdAt: new Date().toISOString(),
        bookedByStaff: true
      };

      const appointmentId = doc(collection(db, 'staff_appointments')).id;
      const staffAppointmentRef = doc(db, 'staff_appointments', appointmentId);
      const patientAppointmentRef = doc(db, 'patient_appointments', appointmentId);

      transaction.set(staffAppointmentRef, appointment);
      transaction.set(patientAppointmentRef, appointment);
      
      transaction.set(slotLockRef, {
        doctor: formData.doctor,
        appointmentDate: formData.appointmentDate,
        timeSlot: formData.timeSlot,
        appointmentId: appointmentId,
        bookedAt: new Date().toISOString(),
        bookedBy: formData.email,
        bookedByStaff: true
      });
      
      return { appointmentId: appointmentId, appointment, queueNumber };
    });

    setQueueNumber(appointmentData.queueNumber);
    showToast('🎉 Appointment booked successfully!', 'success');

    if (onBookingComplete) {
      onBookingComplete();
    }

    setTimeout(() => {
      handleClose();
    }, 2000);
    
  } catch (error: unknown) {
    console.error('Error booking appointment:', error);
    
    if (error instanceof Error) {
      if (error.message === 'SLOT_TAKEN') {
        showToast('⚠️ This time slot was just booked. Please choose another time.', 'warning');
        if (formData.doctor && formData.appointmentDate && formData.priorityLevel) {
          generateTimeSlots(formData.priorityLevel, formData.doctor, formData.appointmentDate);
        }
      } else if (error.message === 'DOCTOR_UNAVAILABLE') {
        showToast('⚠️ This doctor is unavailable on the selected date.', 'warning');
      } else if (error.message === 'DOCTOR_FULLY_BOOKED') {
        showToast('⚠️ This doctor is fully booked for the selected date.', 'warning');
        if (formData.doctor && formData.appointmentDate && formData.priorityLevel) {
          generateTimeSlots(formData.priorityLevel, formData.doctor, formData.appointmentDate);
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
      email: '',
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
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        ></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full relative z-[101]">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {queueNumber ? 'Appointment Confirmed!' : 'Book Appointment'}
              </h3>
              <button onClick={handleClose} className="text-white hover:text-gray-200 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {queueNumber ? (
              <div className="text-center py-8">
                <div className="mb-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked Successfully!</h4>
                  <p className="text-gray-600 mb-4">Queue number:</p>
                  <div className="inline-block bg-indigo-600 text-white text-4xl font-bold px-8 py-4 rounded-lg">
                    #{queueNumber}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter patient's full name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
                      Age <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="age"
                      min="1"
                      max="150"
                      value={formData.age}
                      onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Age"
                    />
                  </div>
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="gender"
                      value={formData.gender}
                      onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                          className="w-32 h-32 rounded-lg object-cover border-2 border-indigo-600"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, photo: '' }))}
                          className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 transition border border-gray-200"
                        >
                          <X className="w-4 h-4 text-gray-600 hover:text-gray-800" />
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                        >
                          Change Photo
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition cursor-pointer ${
                          isDragOver 
                            ? 'border-indigo-600 bg-indigo-50' 
                            : 'border-gray-300 hover:border-indigo-600 hover:bg-indigo-50'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {isDragOver ? (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Upload className="w-8 h-8 text-indigo-600 mb-2" />
                            <span className="text-sm text-indigo-600 font-medium">Drop image here</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Camera className="w-8 h-8 text-gray-400 mb-2" />
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
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="patient@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">+63</span>
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => {
                        const numbersOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                        setFormData(prev => ({ ...prev, phone: numbersOnly }));
                      }}
                      className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="912 345 6789"
                      maxLength={11}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter 11-digit PH mobile number (e.g., 09123456789)
                  </p>
                </div>

                <div>
                  <label htmlFor="priorityLevel" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="priorityLevel"
                    value={formData.priorityLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, priorityLevel: e.target.value, timeSlot: '' }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="normal">🟢 Normal (1 hour slots)</option>
                    <option value="urgent">🟡 Urgent (30 min buffer)</option>
                    <option value="emergency">🔴 Emergency (15 min buffer)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="doctor" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Doctor <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="doctor"
                    value={formData.doctor}
                    onChange={(e) => setFormData(prev => ({ ...prev, doctor: e.target.value, timeSlot: '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                    Appointment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="appointmentDate"
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, appointmentDate: e.target.value, timeSlot: '' }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="timeSlot" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Time Slot <span className="text-red-500">*</span>
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
                              Dr. {formData.doctor} is unavailable on this date.
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
                              !formData.email || !formData.medicalCondition ||
                              (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim())) && (
                              <div className="mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-blue-700 text-xs font-medium">
                                  📝 Please fill all required fields to add patient to waiting list
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
                              
                              {/* Add to Waiting List Button */}
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    // Validate required fields for staff
                                    if (!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
                                        !formData.email || !formData.medicalCondition || !formData.doctor || !formData.appointmentDate ||
                                        (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim())) {
                                      showToast('Please fill in all required fields before adding to waiting list.', 'warning');
                                      return;
                                    }

                                    console.log('🔄 Staff adding patient to waiting list...', {
                                      patient: formData.fullName,
                                      doctor: formData.doctor,
                                      date: formData.appointmentDate,
                                      email: formData.email,
                                      addedBy: 'staff'
                                    });

                                    // Create waiting list entry with staff-specific data
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
                                      email: formData.email,
                                      priorityLevel: formData.priorityLevel,
                                      preferredTimeSlot: formData.timeSlot || '',
                                      requestedDate: formData.appointmentDate,
                                      status: 'waiting',
                                      createdAt: new Date().toISOString(),
                                      patientId: '', // No specific patient ID for staff-added entries
                                      // Staff-specific tracking fields
                                      lastUpdated: new Date().toISOString(),
                                      autoAssignAttempts: 0,
                                      addedBy: 'staff', // Track that this was added by staff
                                      staffAdded: true // Additional flag for staff entries
                                    };

                                    // Add to waiting list collection
                                    await addDoc(waitingListRef, waitingListData);
                                    
                                    console.log('✅ Staff successfully added patient to waiting list:', waitingListData);
                                    
                                    showToast('✅ Patient has been added to the waiting list! They will be auto-assigned when slots become available.', 'success');
                                    
                                    // Close modal after successful addition
                                    setTimeout(() => {
                                      handleClose();
                                    }, 2000);
                                  } catch (error) {
                                    console.error('❌ Staff error adding to waiting list:', error);
                                    console.error('Error details:', error);
                                    showToast('Failed to add patient to waiting list. Please try again.', 'error');
                                  }
                                }}
                                disabled={!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
                                          !formData.email || !formData.medicalCondition || !formData.doctor || !formData.appointmentDate ||
                                          (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim())}
                                className="px-4 py-2 bg-orange-600 text-white border-2 border-orange-600 rounded-lg text-sm font-medium hover:bg-orange-700 transition disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                              >
                                📋 Add to Waiting List
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
                              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <h4 className="text-xl font-bold text-gray-700 mb-2">Checking availability...</h4>
                          </div>
                        );
                      }

                      if (isDoctorUnavailable || (!hasAvailableSlots && !hasSlots)) {
                        return (
                          <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                            <p className="text-gray-500">Please choose another option.</p>
                          </div>
                        );
                      }

                      if (availableTimeSlots.length > 0) {
                        return (
                          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg">
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
                            
                            if (formData.timeSlot === slot.time && isAvailable) {
                              buttonClasses += ' ring-2 ring-indigo-500 ring-offset-2';
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
                              >
                                <div className="flex flex-col items-center">
                                  <span className="font-semibold">{convertTo12Hour(slot.time)}</span>
                                  <span className={statusLabelClasses}>
                                    {statusLabel}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        );
                      }
                      
                      return (
                        <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                          <p className="text-gray-500">Unable to load time slots.</p>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                      <p className="text-gray-500">Please select doctor, date, and priority level.</p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="medicalCondition" className="block text-sm font-medium text-gray-700 mb-2">
                    Eye Condition <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="medicalCondition"
                    value={formData.medicalCondition}
                    onChange={(e) => setFormData(prev => ({ ...prev, medicalCondition: e.target.value, customCondition: '' }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select eye condition</option>
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
                      Please Specify <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="customCondition"
                      value={formData.customCondition}
                      onChange={(e) => setFormData(prev => ({ ...prev, customCondition: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Describe the condition"
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
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Booking...' : 'Book Appointment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && toast.show && (
        <div className="fixed top-4 right-4 z-[200] max-w-md w-full">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-orange-500 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
          `}>
            {toast.type === 'success' && <CheckCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'warning' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-6 h-6 flex-shrink-0" />}
            <p className="font-medium flex-1">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80 transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffBookAppointment;