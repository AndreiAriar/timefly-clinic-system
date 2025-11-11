import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

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
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
  status: string;
  createdAt: string;
}

// Add Doctor interface
interface Doctor {
  id: string;
  name: string;
  specialty: string;
  isActive: boolean;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Updated doctors state to fetch from Firebase
  const [doctors, setDoctors] = useState<Doctor[]>([]);

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
  
  // NEW: Set pre-filled data when modal opens or preFilledData changes
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

// Load doctors from Firebase
const loadDoctors = async () => {
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
    alert('Failed to load doctors. Please check your permissions or try again.');
  }
};

useEffect(() => {
  loadDoctors();
}, []);

const recalculateQueueNumbers = async (appointmentDate: string) => {
  try {
    const appointmentsRef = collection(db, 'appointments');
    const q = query(
      appointmentsRef,
      where('appointmentDate', '==', appointmentDate)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;
    
    // Get all appointments for this date
    const appointments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      timeSlot: doc.data().timeSlot as string
    }));
    
    // Sort by time chronologically
    appointments.sort((a, b) => {
      const [hoursA, minutesA] = a.timeSlot.split(':').map(Number);
      const [hoursB, minutesB] = b.timeSlot.split(':').map(Number);
      const timeA = hoursA * 60 + minutesA;
      const timeB = hoursB * 60 + minutesB;
      return timeA - timeB;
    });
    
    // Update queue numbers for all appointments in chronological order
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
        where('appointmentDate', '==', appointmentDate)
      );
      
      const querySnapshot = await getDocs(q);
      const bookedSlots = querySnapshot.docs.map(doc => doc.data().timeSlot as string);
      
      return bookedSlots;
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      return [];
    }
  }, []);

const isPastTime = (date: string, time: string): boolean => {
  const now = new Date();
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  
  const appointmentDateTime = new Date(year, month - 1, day, hours, minutes);
  
  // Return true if appointment time is less than or EQUAL to current time
  // This ensures current time is also excluded, only future times are shown
  return appointmentDateTime <= now;
};

const generateTimeSlots = useCallback(async (priorityLevel: string, doctor: string, appointmentDate: string) => {
  console.log(`\n🔄 Generating time slots for ${doctor} on ${appointmentDate}, priority: ${priorityLevel}`);
  
  const slots: TimeSlot[] = [];
  const startHour = 8;
  const endHour = 17;
  
  // Get booked slots
  const bookedSlots = await getBookedTimeSlots(doctor, appointmentDate);
  console.log('📋 Booked slots:', bookedSlots);
  
  // Get doctor data for calendar settings
  const doctorsRef = collection(db, 'doctors');
  const doctorQuery = query(doctorsRef, where('name', '==', doctor));
  const doctorSnapshot = await getDocs(doctorQuery);
  
  let unavailableTimeSlots: string[] = [];
  let isDoctorUnavailable = false;
  
  if (!doctorSnapshot.empty) {
    const doctorData = doctorSnapshot.docs[0].data();
    
    // Check if doctor is unavailable on this date
    const unavailableDates = doctorData.unavailableDates || {};
    isDoctorUnavailable = unavailableDates[appointmentDate] === true;
    
    // Get unavailable time slots for this date
    unavailableTimeSlots = doctorData.availableSlots?.[appointmentDate] || [];
    console.log('⛔ Doctor unavailable on date:', isDoctorUnavailable);
    console.log('⛔ Unavailable time slots:', unavailableTimeSlots);
  }
  
  // If doctor is completely unavailable on this date, return empty slots
  if (isDoctorUnavailable) {
    console.log('❌ Doctor is unavailable on this date');
    setAvailableTimeSlots([]);
    return;
  }

  if (priorityLevel === 'normal') {
    // Normal: 1-hour slots (8:00, 9:00, 10:00, etc.)
    for (let hour = startHour; hour < endHour; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      const isBooked = bookedSlots.includes(timeString);
      const isPast = isPastTime(appointmentDate, timeString);
      const isUnavailable = unavailableTimeSlots.includes(timeString);
      
      // ✅ FIXED: Show slot even if unavailable, just mark it as not available
      if (!isPast) {
        slots.push({
          time: timeString,
          available: !isBooked && !isUnavailable
        });
        console.log(`  ${timeString}: ${!isBooked && !isUnavailable ? '✅ Available' : '❌ Unavailable'} (booked: ${isBooked}, unavailable: ${isUnavailable})`);
      }
    }
  } else if (priorityLevel === 'urgent') {
    // Urgent: 30-minute buffer slots (8:30, 9:30, 10:30, etc.)
    for (let hour = startHour; hour < endHour; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:30`;
      const isBooked = bookedSlots.includes(timeString);
      const isPast = isPastTime(appointmentDate, timeString);
      const isUnavailable = unavailableTimeSlots.includes(timeString);
      
      if (!isPast) {
        slots.push({
          time: timeString,
          available: !isBooked && !isUnavailable,
          isBuffer: true,
          bufferType: 'urgent'
        });
      }
    }
  } else if (priorityLevel === 'emergency') {
    // Emergency: 15-minute buffer slots (8:15, 8:45, 9:15, 9:45, etc.)
    for (let hour = startHour; hour < endHour; hour++) {
      // :15 slots
      const timeString15 = `${hour.toString().padStart(2, '0')}:15`;
      const isBooked15 = bookedSlots.includes(timeString15);
      const isPast15 = isPastTime(appointmentDate, timeString15);
      const isUnavailable15 = unavailableTimeSlots.includes(timeString15);
      
      if (!isPast15) {
        slots.push({
          time: timeString15,
          available: !isBooked15 && !isUnavailable15,
          isBuffer: true,
          bufferType: 'emergency'
        });
      }
      
      // :45 slots
      const timeString45 = `${hour.toString().padStart(2, '0')}:45`;
      const isBooked45 = bookedSlots.includes(timeString45);
      const isPast45 = isPastTime(appointmentDate, timeString45);
      const isUnavailable45 = unavailableTimeSlots.includes(timeString45);
      
      if (!isPast45) {
        slots.push({
          time: timeString45,
          available: !isBooked45 && !isUnavailable45,
          isBuffer: true,
          bufferType: 'emergency'
        });
      }
    }
  }

  console.log(`✅ Generated ${slots.length} time slots`);
  setAvailableTimeSlots(slots);
}, [getBookedTimeSlots]);

  useEffect(() => {
    if (formData.doctor && formData.appointmentDate && formData.priorityLevel) {
      generateTimeSlots(formData.priorityLevel, formData.doctor, formData.appointmentDate);
    } else {
      setAvailableTimeSlots([]);
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
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

// UPDATED: Handle booking completion
const handleSubmit = async () => {
  if (!formData.fullName || !formData.age || !formData.gender || !formData.phone || 
      !formData.doctor || !formData.appointmentDate || !formData.timeSlot || !formData.medicalCondition) {
    alert('Please fill in all required fields');
    return;
  }

  if (formData.medicalCondition === 'Other (Please Specify)' && !formData.customCondition.trim()) {
    alert('Please specify your medical condition');
    return;
  }

  setIsSubmitting(true);
  
  try {
    const finalMedicalCondition = formData.medicalCondition === 'Other (Please Specify)' 
      ? formData.customCondition 
      : formData.medicalCondition;

    const appointment: Appointment = {
      fullName: formData.fullName,
      age: formData.age,
      photo: formData.photo,
      doctor: formData.doctor,
      appointmentDate: formData.appointmentDate,
      gender: formData.gender,
      medicalCondition: finalMedicalCondition,
      phone: formData.phone,
      priorityLevel: formData.priorityLevel,
      timeSlot: formData.timeSlot,
      queueNumber: 0, // Temporary, will be recalculated
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Add to Firestore
    const appointmentsRef = collection(db, 'appointments');
    const docRef = await addDoc(appointmentsRef, appointment);

    // Recalculate queue numbers for all appointments on this date
    await recalculateQueueNumbers(formData.appointmentDate);

    // Get the actual queue number that was assigned to this appointment
    const appointmentDoc = await getDocs(query(
      collection(db, 'appointments'),
      where('__name__', '==', docRef.id)
    ));
    
    const actualQueueNumber = appointmentDoc.docs[0]?.data().queueNumber || 1;
    setQueueNumber(actualQueueNumber);

    // Call onBookingComplete if provided
    if (onBookingComplete) {
      onBookingComplete();
    }

    setTimeout(() => {
      handleClose();
    }, 2000);
  } catch (error) {
    console.error('Error booking appointment:', error);
    alert('Failed to book appointment. Please try again.');
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
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="09XX XXX XXXX"
                    aria-required="true"
                  />
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
                  >
                    <option value="normal">Normal (1 hour slots)</option>
                    <option value="urgent">Urgent (30 minute buffer slots)</option>
                    <option value="emergency">Emergency (15 minute buffer slots)</option>
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
                  />
                </div>

                {availableTimeSlots.length > 0 && (
                  <div>
                    <label htmlFor="timeSlot" className="block text-sm font-medium text-gray-700 mb-2">
                      Select Time Slot <span className="text-red-500" aria-label="required">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg" role="group" aria-label="Time slot selection">
                      {availableTimeSlots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setFormData(prev => ({ ...prev, timeSlot: slot.time }))}
                          className={`px-3 py-3 rounded-lg text-sm font-medium transition ${
                            formData.timeSlot === slot.time
                              ? 'bg-blue-600 text-white'
                              : slot.available
                              ? slot.isBuffer && slot.bufferType === 'emergency'
                                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                : slot.isBuffer && slot.bufferType === 'urgent'
                                ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-gray-50 text-gray-400 cursor-not-allowed line-through'
                          }`}
                          aria-pressed={formData.timeSlot === slot.time ? "true" : "false"}
                          aria-label={`Time slot ${convertTo12Hour(slot.time)}${slot.isBuffer ? ` ${slot.bufferType} buffer` : ''}, ${slot.available ? 'available' : 'booked'}`}
                        >
                          <div className="flex flex-col items-center">
                            <span className="font-semibold">{convertTo12Hour(slot.time)}</span>
                            {slot.isBuffer && slot.bufferType === 'emergency' && (
                              <span className="text-xs mt-1">Emergency Buffer</span>
                            )}
                            {slot.isBuffer && slot.bufferType === 'urgent' && (
                              <span className="text-xs mt-1">Urgent Buffer</span>
                            )}
                            {!slot.available && (
                              <span className="text-xs mt-1">Booked</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Booking...' : 'Book Appointment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentModal;