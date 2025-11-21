import { useState, useEffect } from 'react';
import { X, Save, Clock, User, Calendar, ArrowLeft } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

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

interface ManageDoctorAvailabilityProps {
  date: string;
  doctor: Doctor;
  onClose: () => void;
  onUpdate: () => void;
  onBackToDoctors: () => void;
}

const ManageDoctorAvailability = ({ date, doctor, onClose, onUpdate, onBackToDoctors }: ManageDoctorAvailabilityProps) => {
  const [maxSlots, setMaxSlots] = useState<number | string>(doctor.maxSlots || 10);
  const [isAvailableForDate, setIsAvailableForDate] = useState<boolean>(true);
  const [unavailableSlots, setUnavailableSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to get date in Philippine timezone
  const getTodayPH = () => {
    const now = new Date();
    const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const year = phTime.getFullYear();
    const month = String(phTime.getMonth() + 1).padStart(2, '0');
    const day = String(phTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTo12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Generate time slots from 8:00 to 17:00 in 30-minute intervals
  const generateTimeSlots = () => {
    const slots = [];
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
    const loadDoctorData = async () => {
      try {
        const doctorRef = doc(db, 'doctors', doctor.id);
        const doctorDoc = await getDoc(doctorRef);
        
        if (doctorDoc.exists()) {
          const doctorData = doctorDoc.data();
          
          // Load date-specific max slots or fallback to global maxSlots
          const dateSpecificMaxSlots = doctorData.maxSlotsPerDate?.[date];
          setMaxSlots(dateSpecificMaxSlots ?? doctorData.maxSlots ?? 10);
          
          // Check if this specific date is marked as unavailable
          const unavailableDates = doctorData.unavailableDates || {};
          setIsAvailableForDate(!unavailableDates[date]);
          
          // Load unavailable time slots for this specific date
          setUnavailableSlots(doctorData.availableSlots?.[date] || []);
        }
      } catch (error) {
        console.error('Error loading doctor data:', error);
        toast.error('Failed to load doctor data');
      }
    };

    loadDoctorData();
  }, [date, doctor.id]);

  const toggleTimeSlot = (timeSlot: string) => {
    setUnavailableSlots(prev => {
      if (prev.includes(timeSlot)) {
        // Remove from unavailable list (make it available)
        return prev.filter(slot => slot !== timeSlot);
      } else {
        // Add to unavailable list
        return [...prev, timeSlot];
      }
    });
  };

  const handleMaxSlotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    if (/^\d*$/.test(value)) {
      setMaxSlots(value === '' ? '' : parseInt(value));
    }
  };

  const handleSave = async (): Promise<void> => {
    const maxSlotsNumber = typeof maxSlots === 'string' ? parseInt(maxSlots) || 0 : maxSlots;
    
    if (maxSlotsNumber < 1) {
      toast.error('Please enter a valid number of slots (minimum 1)');
      return;
    }

    setIsLoading(true);
    try {
      const doctorRef = doc(db, 'doctors', doctor.id);

      // Get current doctor data to merge with
      const doctorDoc = await getDoc(doctorRef);
      if (!doctorDoc.exists()) {
        throw new Error('Doctor document not found');
      }
      
      const currentData = doctorDoc.data();
      console.log('=== BEFORE SAVE ===');
      console.log('Current maxSlotsPerDate:', currentData?.maxSlotsPerDate);
      console.log('Current globalMaxSlots:', currentData?.maxSlots);
      console.log('Date being configured:', date);
      console.log('New value for this date:', maxSlotsNumber);

      // Handle unavailable dates
      const unavailableDates = { ...(currentData?.unavailableDates || {}) };
      if (!isAvailableForDate) {
        unavailableDates[date] = true;
      } else {
        delete unavailableDates[date];
      }

      // Handle unavailable time slots (stored in availableSlots field)
      const availableSlots = { ...(currentData?.availableSlots || {}) };
      if (unavailableSlots.length > 0) {
        availableSlots[date] = [...unavailableSlots];
      } else {
        delete availableSlots[date];
      }

      // Store per-date max slots properly
      const maxSlotsPerDate = { ...(currentData?.maxSlotsPerDate || {}) };
      maxSlotsPerDate[date] = maxSlotsNumber;

      console.log('=== SAVING ===');
      console.log('Update payload:');
      console.log('  - maxSlotsPerDate:', maxSlotsPerDate);
      console.log('  - unavailableDates:', unavailableDates);
      console.log('  - availableSlots (unavailable time slots):', availableSlots);

      // Save per-date configuration (does NOT affect global maxSlots)
      await updateDoc(doctorRef, {
        maxSlotsPerDate,
        unavailableDates,
        availableSlots,
        updatedAt: new Date().toISOString()
      });

      // Verify the save worked
      const verifyDoc = await getDoc(doctorRef);
      const verifyData = verifyDoc.data();
      console.log('=== AFTER SAVE (VERIFICATION) ===');
      console.log('Saved maxSlotsPerDate:', verifyData?.maxSlotsPerDate);
      console.log('Value for our date:', verifyData?.maxSlotsPerDate?.[date]);
      console.log('Global maxSlots (should be unchanged):', verifyData?.maxSlots);
      
      if (verifyData?.maxSlotsPerDate?.[date] !== maxSlotsNumber) {
        console.error('❌ SAVE VERIFICATION FAILED!');
        console.error('Expected:', maxSlotsNumber);
        console.error('Got:', verifyData?.maxSlotsPerDate?.[date]);
        throw new Error('Save verification failed - data not persisted correctly');
      }
      
      console.log('✅ Save verified successfully');
      console.log('✅ Per-date configuration saved WITHOUT affecting other dates');

      toast.success(`Doctor availability updated successfully for ${formatDatePH(date)}`, {
        autoClose: 3000,
        position: "top-right"
      });
      
      // Call onUpdate to refresh the calendar
      await onUpdate();
      onClose();
    } catch (error) {
      console.error('❌ Error updating doctor availability:', error);
      
      if (error instanceof Error) {
        toast.error(`Failed to update: ${error.message}`);
      } else {
        toast.error('Failed to update doctor availability');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatDatePH = (dateString: string) => {
    // Parse the date string as YYYY-MM-DD
    const [year, month, day] = dateString.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila'
    });
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
              <span>{formatDatePH(date)}</span>
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
                  type="button"
                  onClick={() => setIsAvailableForDate(!isAvailableForDate)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    isAvailableForDate ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  aria-label={isAvailableForDate ? 'Mark as unavailable' : 'Mark as available'}
                  title={isAvailableForDate ? 'Mark as unavailable' : 'Mark as available'}
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
                      type="button"
                      onClick={() => toggleTimeSlot(timeSlot)}
                      className={`p-3 rounded-lg text-sm font-medium transition-all border-2 ${
                        isSlotUnavailable
                          ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
                      }`}
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
            type="button"
            onClick={onBackToDoctors}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition font-medium flex items-center gap-2"
            disabled={isLoading}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Doctors
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
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

export default ManageDoctorAvailability;