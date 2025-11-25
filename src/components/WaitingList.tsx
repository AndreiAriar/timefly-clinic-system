import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, doc, deleteDoc, where, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Clock, User, Calendar, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'react-toastify';

interface WaitingListEntry {
  id: string;
  fullName: string;
  age: string;
  photo: string;
  doctor: string;
  appointmentDate: string;
  gender: string;
  medicalCondition: string;
  phone: string;
  email?: string;
  priorityLevel: string;
  preferredTimeSlot?: string;
  requestedDate: string;
  createdAt: string;
  status: 'waiting';
  patientId?: string;
}

interface Doctor {
  id: string;
  name: string;
  maxSlots: number;
  maxSlotsPerDate?: { [date: string]: number };
  availableSlots: { [date: string]: string[] };
  unavailableDates?: { [date: string]: boolean };
}

interface Appointment {
  id: string;
  queueNumber: number;
  timeSlot: string;
  status: string;
}

const WaitingList = () => {
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<WaitingListEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Enhanced real-time listener for waiting list with error handling
  useEffect(() => {
    console.log('🔄 Setting up enhanced real-time waiting list listener...');
    
    const waitingListRef = collection(db, 'waitingList');
    const q = query(waitingListRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log('📋 Firestore snapshot received:', snapshot.size, 'documents');
        
        const entries: WaitingListEntry[] = [];
        snapshot.forEach((doc) => {
          try {
            const data = doc.data();
            console.log('📄 Processing document:', doc.id, data);
            
            // Validate required fields
            if (!data.fullName || !data.doctor || !data.appointmentDate) {
              console.warn('⚠️ Skipping invalid waiting list entry:', doc.id, data);
              return;
            }
            
            entries.push({
              id: doc.id,
              fullName: data.fullName || '',
              age: data.age || '',
              photo: data.photo || '',
              doctor: data.doctor,
              appointmentDate: data.appointmentDate,
              gender: data.gender || '',
              medicalCondition: data.medicalCondition || '',
              phone: data.phone || '',
              email: data.email || '',
              priorityLevel: data.priorityLevel || 'normal',
              preferredTimeSlot: data.preferredTimeSlot || '',
              requestedDate: data.requestedDate || data.appointmentDate,
              createdAt: data.createdAt || new Date().toISOString(),
              status: data.status || 'waiting',
              patientId: data.patientId || ''
            });
          } catch (error) {
            console.error('❌ Error processing document:', doc.id, error);
          }
        });
        
        console.log('✅ Processed waiting list entries:', entries.length);
        setWaitingList(entries);
        setLastUpdate(Date.now());
        setIsLoading(false);
      }, 
      (error) => {
        console.error('❌ Error listening to waiting list:', error);
        console.error('Error details:', error.code, error.message);
        
        if (error.code === 'permission-denied') {
          toast.error('❌ Permission denied: Cannot access waiting list. Check Firestore rules.');
        } else if (error.code === 'unavailable') {
          toast.error('🌐 Network error: Cannot connect to database.');
        } else {
          toast.error('Failed to load waiting list: ' + error.message);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔌 Cleaning up waiting list listener');
      unsubscribe();
    };
  }, []);

  const checkSlotAvailability = useCallback(async (doctorName: string, appointmentDate: string): Promise<boolean> => {
    try {
      console.log(`🔍 Checking slot availability for ${doctorName} on ${appointmentDate}`);
      
      // Get doctor data
      const doctorsRef = collection(db, 'doctors');
      const doctorQuery = query(doctorsRef, where('name', '==', doctorName));
      const doctorSnapshot = await getDocs(doctorQuery);
      
      if (doctorSnapshot.empty) {
        console.log('❌ Doctor not found:', doctorName);
        return false;
      }
      
      const doctorData = doctorSnapshot.docs[0].data() as Doctor;
      
      // Check if doctor is unavailable on this date
      const unavailableDates = doctorData.unavailableDates || {};
      if (unavailableDates[appointmentDate]) {
        console.log('❌ Doctor is unavailable on this date');
        return false;
      }
      
      // Get max slots for this date
      const maxSlotsPerDate = doctorData.maxSlotsPerDate || {};
      const dateSpecificMaxSlots = maxSlotsPerDate[appointmentDate];
      const maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : (doctorData.maxSlots || 10);
      
      // Get unavailable time slots
      const unavailableTimeSlots = doctorData.availableSlots?.[appointmentDate] || [];
      const totalAvailableSlots = Math.max(0, maxSlots - unavailableTimeSlots.length);
      
      console.log(`📊 Doctor ${doctorName} has ${totalAvailableSlots} available slots on ${appointmentDate}`);
      
      // Check BOTH collections for active appointments
      const patientAppointmentsRef = collection(db, 'patient_appointments');
      const staffAppointmentsRef = collection(db, 'staff_appointments');
      
      const patientQuery = query(
        patientAppointmentsRef,
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
      );
      
      const staffQuery = query(
        staffAppointmentsRef,
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
      );
      
      const [patientSnapshot, staffSnapshot] = await Promise.all([
        getDocs(patientQuery),
        getDocs(staffQuery)
      ]);
      
      // Use Set to avoid counting duplicates
      const uniqueAppointmentIds = new Set();
      patientSnapshot.docs.forEach(doc => uniqueAppointmentIds.add(doc.id));
      staffSnapshot.docs.forEach(doc => uniqueAppointmentIds.add(doc.id));
      
      const bookedCount = uniqueAppointmentIds.size;
      const hasAvailability = bookedCount < totalAvailableSlots;
      
      console.log(`📋 Slot availability result: ${bookedCount}/${totalAvailableSlots} booked - ${hasAvailability ? 'AVAILABLE' : 'FULL'}`);
      
      return hasAvailability;
    } catch (error) {
      console.error('❌ Error checking slot availability:', error);
      return false;
    }
  }, []);

  // Helper function to get booked slots
  const getBookedSlots = useCallback(async (doctorName: string, appointmentDate: string): Promise<Set<string>> => {
    const patientAppointmentsRef = collection(db, 'patient_appointments');
    const staffAppointmentsRef = collection(db, 'staff_appointments');
    
    const patientQuery = query(
      patientAppointmentsRef,
      where('doctor', '==', doctorName),
      where('appointmentDate', '==', appointmentDate),
      where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
    );
    
    const staffQuery = query(
      staffAppointmentsRef,
      where('doctor', '==', doctorName),
      where('appointmentDate', '==', appointmentDate),
      where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
    );
    
    const [patientSnapshot, staffSnapshot] = await Promise.all([
      getDocs(patientQuery),
      getDocs(staffQuery)
    ]);
    
    const bookedSlots = new Set<string>();
    patientSnapshot.docs.forEach(doc => {
      const timeSlot = doc.data().timeSlot;
      if (timeSlot) bookedSlots.add(timeSlot);
    });
    staffSnapshot.docs.forEach(doc => {
      const timeSlot = doc.data().timeSlot;
      if (timeSlot) bookedSlots.add(timeSlot);
    });
    
    return bookedSlots;
  }, []);

  // Helper function to get unavailable time slots
  const getUnavailableTimeSlots = useCallback(async (doctorName: string, appointmentDate: string): Promise<string[]> => {
    const doctorsRef = collection(db, 'doctors');
    const doctorQuery = query(doctorsRef, where('name', '==', doctorName));
    const doctorSnapshot = await getDocs(doctorQuery);
    
    if (!doctorSnapshot.empty) {
      const doctorData = doctorSnapshot.docs[0].data();
      return doctorData.availableSlots?.[appointmentDate] || [];
    }
    
    return [];
  }, []);

  // Helper function to generate time slots based on priority
  const generateTimeSlots = useCallback((priorityLevel: string): string[] => {
    const timeSlots: string[] = [];
    const startHour = 8;
    const endHour = 17;
    
    if (priorityLevel === 'normal') {
      for (let hour = startHour; hour < endHour; hour++) {
        if (hour === 12) continue;
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    } else if (priorityLevel === 'urgent') {
      for (let hour = startHour; hour < endHour; hour++) {
        if (hour === 12) continue;
        timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    } else if (priorityLevel === 'emergency') {
      for (let hour = startHour; hour < endHour; hour++) {
        if (hour === 12) continue;
        timeSlots.push(`${hour.toString().padStart(2, '0')}:15`);
        timeSlots.push(`${hour.toString().padStart(2, '0')}:45`);
      }
    }
    
    return timeSlots;
  }, []);

  // NEW: Calculate queue number based on time slot position
  const calculateNewQueueNumber = useCallback(async (
    doctorName: string, 
    appointmentDate: string, 
    timeSlot: string
  ): Promise<number> => {
    try {
      console.log(`🧮 Calculating queue number for new time slot: ${timeSlot}`);
      
      const patientAppointmentsRef = collection(db, 'patient_appointments');
      const staffAppointmentsRef = collection(db, 'staff_appointments');
      
      const patientQuery = query(
        patientAppointmentsRef,
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
      );
      
      const staffQuery = query(
        staffAppointmentsRef,
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('status', 'in', ['pending', 'confirmed', 'scheduled', 'serving'])
      );
      
      const [patientSnapshot, staffSnapshot] = await Promise.all([
        getDocs(patientQuery),
        getDocs(staffQuery)
      ]);
      
      // Combine all appointments and remove duplicates
      const allAppointments: Appointment[] = [];
      const appointmentIds = new Set();
      
      patientSnapshot.docs.forEach(doc => {
        if (!appointmentIds.has(doc.id)) {
          appointmentIds.add(doc.id);
          allAppointments.push({
            id: doc.id,
            ...doc.data()
          } as Appointment);
        }
      });
      
      staffSnapshot.docs.forEach(doc => {
        if (!appointmentIds.has(doc.id)) {
          appointmentIds.add(doc.id);
          allAppointments.push({
            id: doc.id,
            ...doc.data()
          } as Appointment);
        }
      });
      
      // Add the new appointment we're about to create
      allAppointments.push({
        id: 'NEW_APPOINTMENT',
        queueNumber: 0,
        timeSlot: timeSlot,
        status: 'confirmed'
      });
      
      // Sort by time slot chronologically
      allAppointments.sort((a, b) => {
        const [hoursA, minutesA] = a.timeSlot.split(':').map(Number);
        const [hoursB, minutesB] = b.timeSlot.split(':').map(Number);
        return (hoursA * 60 + minutesA) - (hoursB * 60 + minutesB);
      });
      
      // Find position of new appointment and assign queue number
      const newAppointmentIndex = allAppointments.findIndex(apt => apt.id === 'NEW_APPOINTMENT');
      const queueNumber = newAppointmentIndex + 1;
      
      console.log(`✅ Calculated queue number ${queueNumber} for time slot ${timeSlot}`);
      return queueNumber;
      
    } catch (error) {
      console.error('❌ Error calculating queue number:', error);
      return 0; // Fallback
    }
  }, []);

  // NEW: Get the queue number from the cancelled appointment's time slot
  const getQueueNumberForTimeSlot = useCallback(async (
    doctorName: string, 
    appointmentDate: string, 
    timeSlot: string
  ): Promise<number> => {
    try {
      console.log(`🔍 Finding queue number for ${timeSlot} with ${doctorName} on ${appointmentDate}`);
      
      // Check both collections for the appointment with this time slot
      const patientAppointmentsRef = collection(db, 'patient_appointments');
      const staffAppointmentsRef = collection(db, 'staff_appointments');
      
      const patientQuery = query(
        patientAppointmentsRef,
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('timeSlot', '==', timeSlot)
      );
      
      const staffQuery = query(
        staffAppointmentsRef,
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('timeSlot', '==', timeSlot)
      );
      
      const [patientSnapshot, staffSnapshot] = await Promise.all([
        getDocs(patientQuery),
        getDocs(staffQuery)
      ]);
      
      // Check patient appointments first
      if (!patientSnapshot.empty) {
        const appointmentData = patientSnapshot.docs[0].data() as Appointment;
        console.log(`✅ Found queue number ${appointmentData.queueNumber} for time slot ${timeSlot}`);
        return appointmentData.queueNumber;
      }
      
      // Check staff appointments if not found in patient appointments
      if (!staffSnapshot.empty) {
        const appointmentData = staffSnapshot.docs[0].data() as Appointment;
        console.log(`✅ Found queue number ${appointmentData.queueNumber} for time slot ${timeSlot}`);
        return appointmentData.queueNumber;
      }
      
      // If no existing appointment found for this time slot, we need to calculate it
      console.log('ℹ️ No existing appointment found for time slot, calculating queue number...');
      return await calculateNewQueueNumber(doctorName, appointmentDate, timeSlot);
      
    } catch (error) {
      console.error('❌ Error getting queue number for time slot:', error);
      // Fallback to calculation
      return await calculateNewQueueNumber(doctorName, appointmentDate, timeSlot);
    }
  }, [calculateNewQueueNumber]);

  const getAvailableTimeSlot = useCallback(async (
    doctorName: string, 
    appointmentDate: string, 
    priorityLevel: string
  ): Promise<{ timeSlot: string | null, replacedAppointmentId?: string }> => {
    try {
      console.log(`🕒 Finding available time slot for ${doctorName} on ${appointmentDate}, priority: ${priorityLevel}`);
      
      // Get recently cancelled appointments (last 5 minutes) to find available slots
      const cancelledRecentlyQuery = query(
        collection(db, 'patient_appointments'),
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('status', '==', 'cancelled')
      );
      
      const [cancelledSnapshot, bookedSlots] = await Promise.all([
        getDocs(cancelledRecentlyQuery),
        getBookedSlots(doctorName, appointmentDate)
      ]);
      
      // Check for recently cancelled appointments first (these should be reassigned)
      if (!cancelledSnapshot.empty) {
        const recentlyCancelled = cancelledSnapshot.docs[0];
        const cancelledData = recentlyCancelled.data();
        const cancelledTimeSlot = cancelledData.timeSlot;
        
        console.log(`🔄 Found recently cancelled appointment at ${cancelledTimeSlot}, reassigning this slot`);
        
        // Verify this time slot is still available (not rebooked yet)
        if (!bookedSlots.has(cancelledTimeSlot)) {
          return { 
            timeSlot: cancelledTimeSlot, 
            replacedAppointmentId: recentlyCancelled.id 
          };
        }
      }
      
      // If no recently cancelled appointments, find first available slot
      const unavailableTimeSlots = await getUnavailableTimeSlots(doctorName, appointmentDate);
      const timeSlots = generateTimeSlots(priorityLevel);
      
      for (const slot of timeSlots) {
        if (!bookedSlots.has(slot) && !unavailableTimeSlots.includes(slot)) {
          console.log('✅ Found available time slot:', slot);
          return { timeSlot: slot };
        }
      }
      
      console.log('❌ No available time slots found');
      return { timeSlot: null };
    } catch (error) {
      console.error('❌ Error getting available time slot:', error);
      return { timeSlot: null };
    }
  }, [getBookedSlots, getUnavailableTimeSlots, generateTimeSlots]);

  const sendAssignmentEmail = useCallback(async (patientEmail: string, patientName: string, doctor: string, 
                                   appointmentDate: string, timeSlot: string, queueNumber: number) => {
    if (!patientEmail) {
      console.log('ℹ️ No email provided, skipping email notification');
      return;
    }
    
    try {
      const response = await fetch('/api/send-assignment-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientEmail,
          patientName,
          doctor,
          appointmentDate,
          timeSlot,
          queueNumber,
          assignedBy: 'Staff'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email notification');
      }

      console.log('✅ Assignment email sent successfully to:', patientEmail);
    } catch (error) {
      console.error('❌ Error sending assignment email:', error);
    }
  }, []);
  
  // FIXED: Enhanced autoAssignToAppointment with proper queue number assignment and dependencies
  const autoAssignToAppointment = useCallback(async (entry: WaitingListEntry) => {
    try {
      console.log('🔄 Auto-assigning', entry.fullName, 'to appointment...');
      
      // Get available time slot (now returns both timeSlot and replacedAppointmentId)
      const { timeSlot, replacedAppointmentId } = await getAvailableTimeSlot(
        entry.doctor, 
        entry.appointmentDate, 
        entry.priorityLevel
      );
      
      if (!timeSlot) {
        console.log('❌ No available time slot found for auto-assignment');
        return;
      }
      
      // ✅ FIXED: Get proper queue number for the time slot
      const queueNumber = await getQueueNumberForTimeSlot(
        entry.doctor, 
        entry.appointmentDate, 
        timeSlot
      );
      
      console.log(`🎯 Assigning queue number ${queueNumber} to ${entry.fullName} for time slot ${timeSlot}`);
      
      // Create appointment in BOTH collections
      const patientAppointmentsRef = collection(db, 'patient_appointments');
      const staffAppointmentsRef = collection(db, 'staff_appointments');
      
      const appointmentData = {
        fullName: entry.fullName,
        age: entry.age,
        photo: entry.photo,
        doctor: entry.doctor,
        appointmentDate: entry.appointmentDate,
        gender: entry.gender,
        medicalCondition: entry.medicalCondition,
        phone: entry.phone,
        email: entry.email || '',
        priorityLevel: entry.priorityLevel,
        timeSlot: timeSlot,
        queueNumber: queueNumber, // ✅ Now using proper queue number
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        assignedFromWaitingList: true,
        autoAssigned: true,
        originalWaitingListId: entry.id,
        replacedAppointmentId: replacedAppointmentId || null // Track which appointment this replaced
      };
      
      // Use the same ID for both collections to maintain consistency
      const appointmentId = doc(patientAppointmentsRef).id;
      
      const batch = writeBatch(db);
      batch.set(doc(patientAppointmentsRef, appointmentId), appointmentData);
      batch.set(doc(staffAppointmentsRef, appointmentId), appointmentData);
      
      await batch.commit();
      
      // Send email notification if email is available
      if (entry.email) {
        await sendAssignmentEmail(
          entry.email,
          entry.fullName,
          entry.doctor,
          entry.appointmentDate,
          timeSlot,
          queueNumber
        );
      }
      
      // Remove from waiting list
      const waitingListRef = doc(db, 'waitingList', entry.id);
      await deleteDoc(waitingListRef);
      
      toast.success(`✅ ${entry.fullName} has been automatically assigned to ${timeSlot} (Queue #${queueNumber})`, {
        autoClose: 5000,
        position: 'top-right'
      });
      
      console.log('✅ Successfully auto-assigned patient to appointment with proper queue number');
    } catch (error) {
      console.error('❌ Error auto-assigning to appointment:', error);
      toast.error(`Failed to auto-assign ${entry.fullName}`);
    }
  }, [getAvailableTimeSlot, getQueueNumberForTimeSlot, sendAssignmentEmail]);

  // Enhanced auto-assignment with better error handling and logging
  useEffect(() => {
    if (waitingList.length === 0) {
      console.log('ℹ️ No patients in waiting list, skipping auto-assignment check');
      return;
    }

    const checkAndAutoAssign = async () => {
      console.log('🔍 Auto-assignment: Checking for available slots for', waitingList.length, 'waiting patients...');

      for (const entry of waitingList) {
        try {
          console.log(`🔍 Checking availability for ${entry.fullName} with ${entry.doctor} on ${entry.appointmentDate}`);
          const hasAvailableSlot = await checkSlotAvailability(entry.doctor, entry.appointmentDate);
          
          if (hasAvailableSlot) {
            console.log('✅ Found available slot for', entry.fullName, '- proceeding with auto-assignment');
            await autoAssignToAppointment(entry);
            break; // Assign one at a time to avoid conflicts
          } else {
            console.log('❌ No available slots for', entry.fullName);
          }
        } catch (error) {
          console.error('❌ Error checking availability for', entry.fullName, error);
        }
      }
    };

   // Check every 5 seconds, but only if we have patients
    const interval = setInterval(checkAndAutoAssign, 5000);
    
    // Also check immediately when list changes, but with a small delay to avoid race conditions
    const immediateCheck = setTimeout(checkAndAutoAssign, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(immediateCheck);
    };
  }, [waitingList, checkSlotAvailability, autoAssignToAppointment, lastUpdate]);

  // UPDATED: Enhanced manual assignment with proper queue number assignment
  const handleManualAssign = async () => {
    if (!selectedEntry) return;
    
    setIsProcessing(true);
    try {
      console.log('🔄 Manually assigning', selectedEntry.fullName, 'to appointment...');
      
      // Get available time slot (now returns both timeSlot and replacedAppointmentId)
      const { timeSlot, replacedAppointmentId } = await getAvailableTimeSlot(
        selectedEntry.doctor, 
        selectedEntry.appointmentDate, 
        selectedEntry.priorityLevel
      );
      
      if (!timeSlot) {
        toast.error('❌ No available time slots found for this doctor and date');
        setIsProcessing(false);
        return;
      }
      
      // ✅ FIXED: Get proper queue number for the time slot
      const queueNumber = await getQueueNumberForTimeSlot(
        selectedEntry.doctor, 
        selectedEntry.appointmentDate, 
        timeSlot
      );
      
      console.log(`🎯 Assigning queue number ${queueNumber} to ${selectedEntry.fullName} for time slot ${timeSlot}`);
      
      // Create appointment in BOTH collections
      const patientAppointmentsRef = collection(db, 'patient_appointments');
      const staffAppointmentsRef = collection(db, 'staff_appointments');
      
      const appointmentData = {
        fullName: selectedEntry.fullName,
        age: selectedEntry.age,
        photo: selectedEntry.photo,
        doctor: selectedEntry.doctor,
        appointmentDate: selectedEntry.appointmentDate,
        gender: selectedEntry.gender,
        medicalCondition: selectedEntry.medicalCondition,
        phone: selectedEntry.phone,
        email: selectedEntry.email || '',
        priorityLevel: selectedEntry.priorityLevel,
        timeSlot: timeSlot,
        queueNumber: queueNumber, // ✅ Now using proper queue number
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        assignedFromWaitingList: true,
        manuallyAssigned: true,
        assignedBy: 'Staff',
        originalWaitingListId: selectedEntry.id,
        replacedAppointmentId: replacedAppointmentId || null // Track which appointment this replaced
      };
      
      // Use the same ID for both collections
      const appointmentId = doc(patientAppointmentsRef).id;
      
      const batch = writeBatch(db);
      batch.set(doc(patientAppointmentsRef, appointmentId), appointmentData);
      batch.set(doc(staffAppointmentsRef, appointmentId), appointmentData);
      
      await batch.commit();
      
      // Send email notification if email is available
      if (selectedEntry.email) {
        await sendAssignmentEmail(
          selectedEntry.email,
          selectedEntry.fullName,
          selectedEntry.doctor,
          selectedEntry.appointmentDate,
          timeSlot,
          queueNumber
        );
      }
      
      // Remove from waiting list
      const waitingListRef = doc(db, 'waitingList', selectedEntry.id);
      await deleteDoc(waitingListRef);
      
      toast.success(`✅ ${selectedEntry.fullName} has been assigned to ${timeSlot} (Queue #${queueNumber})`, {
        autoClose: 5000,
        position: 'top-right'
      });
      
      console.log('✅ Successfully manually assigned patient to appointment with proper queue number');
      
      setIsModalOpen(false);
      setSelectedEntry(null);
    } catch (error) {
      console.error('❌ Error manually assigning:', error);
      toast.error('Failed to assign patient: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFromWaitingList = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to remove this patient from the waiting list?')) {
      return;
    }
    
    try {
      const waitingListRef = doc(db, 'waitingList', entryId);
      await deleteDoc(waitingListRef);
      toast.success('Patient removed from waiting list');
      console.log('✅ Removed patient from waiting list:', entryId);
    } catch (error) {
      console.error('❌ Error removing from waiting list:', error);
      toast.error('Failed to remove patient');
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      normal: 'bg-blue-100 text-blue-800',
      urgent: 'bg-orange-100 text-orange-800',
      emergency: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[priority as keyof typeof styles] || styles.normal}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading waiting list...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Waiting List</h1>
              <p className="text-gray-600 mt-2">
                Manage patients waiting for available appointment slots
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Last updated: {new Date(lastUpdate).toLocaleTimeString()}
              </p>
            </div>
            <div className="bg-white px-6 py-3 rounded-lg shadow-sm border border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Waiting</p>
                <p className="text-3xl font-bold text-indigo-600">{waitingList.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Queue Assignment:</strong> Patients now inherit the queue number of cancelled appointments they replace.
          </p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Automatic Assignment Enabled</p>
            <p className="text-sm text-blue-700 mt-1">
              Patients will be automatically assigned to appointments when slots become available. 
              The system checks every 30 seconds for openings and assigns proper queue numbers.
            </p>
          </div>
        </div>

        {/* Waiting List */}
        {waitingList.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No patients waiting</h3>
            <p className="text-gray-500">All appointment slots are available or patients have been assigned.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {waitingList.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Patient Photo */}
                    {entry.photo ? (
                      <img
                        src={entry.photo}
                        alt={entry.fullName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200">
                        <User className="w-8 h-8 text-indigo-600" />
                      </div>
                    )}

                    {/* Patient Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{entry.fullName}</h3>
                        {getPriorityBadge(entry.priorityLevel)}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          ID: {entry.id.slice(-6)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{entry.age} years old, {entry.gender}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>Requested: {formatDate(entry.appointmentDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">📞</span>
                          <span>{entry.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">👨‍⚕️</span>
                          <span>{entry.doctor}</span>
                        </div>
                      </div>

                      {entry.email && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="text-gray-400">📧</span>
                          <span className="ml-2">{entry.email}</span>
                        </div>
                      )}

                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Condition:</span> {entry.medicalCondition}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Added to waiting list: {formatDateTime(entry.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setIsModalOpen(true);
                      }}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-medium text-sm flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Assign Now
                    </button>
                    <button
                      onClick={() => handleRemoveFromWaitingList(entry.id)}
                      className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium text-sm flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && selectedEntry && (
       <div className="fixed inset-0 bg-transparent backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Assign to Appointment</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedEntry(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to assign <strong>{selectedEntry.fullName}</strong> to an available appointment slot?
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>Doctor:</strong> {selectedEntry.doctor}<br />
                  <strong>Date:</strong> {formatDate(selectedEntry.appointmentDate)}<br />
                  <strong>Priority:</strong> {selectedEntry.priorityLevel.toUpperCase()}
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-green-800">
                  <strong>🎯 Queue Assignment:</strong> Patient will inherit the queue number of the cancelled appointment they replace.
                </p>
              </div>

              {selectedEntry.email && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-800">
                    <strong>📧 Email Notification:</strong> An email will be sent to {selectedEntry.email} confirming their appointment assignment.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedEntry(null);
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualAssign}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaitingList;