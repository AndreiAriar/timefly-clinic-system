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
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl my-4 sm:my-8 border border-gray-200 mx-auto">
        {/* Header - Sticky */}
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600 sticky top-0 z-10 rounded-t-lg">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" />
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-white truncate">
              Manage Availability
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-white/20 transition text-white flex-shrink-0 ml-2"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-180px)] overflow-y-auto">
          {/* Selected Date */}
          <div className="p-3 sm:p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-indigo-700">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-semibold text-sm sm:text-base">Selected Date:</span>
              </div>
              <span className="text-sm sm:text-base break-words pl-6 sm:pl-0">
                {formatDatePH(date)}
              </span>
            </div>
          </div>

          {/* Doctor Information */}
          <div className="p-3 sm:p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
              {doctor.photo ? (
                <img
                  src={doctor.photo}
                  alt={`Dr. ${doctor.name}`}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-indigo-200 flex-shrink-0 mx-auto sm:mx-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200 flex-shrink-0 mx-auto sm:mx-0">
                  <User className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" />
                </div>
              )}
              <div className="flex-1 min-w-0 w-full">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 text-center sm:text-left">
                  Dr. {doctor.name}
                </h3>
                <p className="text-gray-600 text-sm sm:text-base text-center sm:text-left">{doctor.specialty}</p>
                <div className="flex flex-col gap-2 mt-2 sm:mt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm text-gray-500 font-medium">Email:</span>
                    <span className="text-xs sm:text-sm break-all">{doctor.email}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm text-gray-500 font-medium">Phone:</span>
                    <span className="text-xs sm:text-sm">{doctor.phone}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Availability Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Max Slots Input */}
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Max Slots for this Day:</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxSlots}
                  onChange={handleMaxSlotsChange}
                  className="w-full px-3 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter number of slots"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Total number of appointment slots available for this day
              </p>
            </div>

            {/* Availability Toggle */}
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                <span className="text-sm sm:text-base">Doctor Availability:</span>
              </label>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-300">
                <span className={`font-medium text-sm sm:text-base ${isAvailableForDate ? 'text-green-600' : 'text-red-600'}`}>
                  {isAvailableForDate ? 'Available' : 'Unavailable'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAvailableForDate(!isAvailableForDate)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex-shrink-0 ${
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
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Time Slots Management</h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Click on time slots to mark them as unavailable. Unavailable slots will be shown in red.
              </p>
            </div>
            
            <div className="p-2 sm:p-3 md:p-4">
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2 md:gap-3">
                {timeSlots.map((timeSlot) => {
                  const isSlotUnavailable = unavailableSlots.includes(timeSlot);
                  
                  return (
                    <button
                      key={timeSlot}
                      type="button"
                      onClick={() => toggleTimeSlot(timeSlot)}
                      className={`p-2 sm:p-2.5 md:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all border-2 min-h-[56px] sm:min-h-[64px] md:min-h-[70px] flex items-center justify-center active:scale-95 ${
                        isSlotUnavailable
                          ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-center space-y-0.5 sm:space-y-1">
                        <div className="font-semibold leading-tight text-xs sm:text-sm">{formatTo12Hour(timeSlot)}</div>
                        {isSlotUnavailable && (
                          <div className="text-[9px] sm:text-[10px] px-1 py-0.5 rounded-full bg-red-100 text-red-700 leading-none">
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
      {/* Footer - Responsive Button Layout */}
      <div className="p-3 sm:p-4 md:p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0 rounded-b-lg">
        <div className="flex flex-col gap-2 sm:gap-3">
          {/* Save Changes Button - Always full width on mobile */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="w-full px-3 sm:px-4 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm hover:shadow-md"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white flex-shrink-0"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span>Save Changes</span>
              </>
            )}
          </button>
          
          {/* Cancel Button - Always full width on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 sm:px-4 py-3 text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-all font-medium text-sm sm:text-base active:scale-[0.98]"
            disabled={isLoading}
          >
            Cancel
          </button>
          
          {/* Back to Doctors button - Always full width */}
          <button
            type="button"
            onClick={onBackToDoctors}
            className="w-full px-3 sm:px-4 py-3 text-indigo-600 bg-indigo-50 border-2 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm sm:text-base active:scale-[0.98]"
            disabled={isLoading}
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>Back to Doctors</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ManageDoctorAvailability;