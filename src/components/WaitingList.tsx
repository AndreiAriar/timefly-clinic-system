import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, addDoc, where, orderBy, onSnapshot } from 'firebase/firestore';
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
  priorityLevel: string;
  preferredTimeSlot?: string;
  requestedDate: string;
  createdAt: string;
  status: 'waiting';
}

interface Doctor {
  id: string;
  name: string;
  maxSlots: number;
  maxSlotsPerDate?: { [date: string]: number };
  availableSlots: { [date: string]: string[] };
  unavailableDates?: { [date: string]: boolean };
}

const WaitingList = () => {
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<WaitingListEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Real-time listener for waiting list
  useEffect(() => {
    console.log('🔄 Setting up real-time waiting list listener...');
    
    const waitingListRef = collection(db, 'waitingList');
    const q = query(waitingListRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WaitingListEntry[];
      
      console.log('📋 Waiting list updated:', entries.length, 'entries');
      setWaitingList(entries);
      setIsLoading(false);
    }, (error) => {
      console.error('❌ Error listening to waiting list:', error);
      toast.error('Failed to load waiting list');
      setIsLoading(false);
    });

    return () => {
      console.log('🔌 Cleaning up waiting list listener');
      unsubscribe();
    };
  }, []);

  const checkSlotAvailability = useCallback(async (doctorName: string, appointmentDate: string): Promise<boolean> => {
    try {
      // Get doctor data
      const doctorsRef = collection(db, 'doctors');
      const doctorQuery = query(doctorsRef, where('name', '==', doctorName));
      const doctorSnapshot = await getDocs(doctorQuery);
      
      if (doctorSnapshot.empty) return false;
      
      const doctorData = doctorSnapshot.docs[0].data() as Doctor;
      
      // Check if doctor is unavailable on this date
      const unavailableDates = doctorData.unavailableDates || {};
      if (unavailableDates[appointmentDate]) {
        return false;
      }
      
      // Get max slots for this date
      const maxSlotsPerDate = doctorData.maxSlotsPerDate || {};
      const dateSpecificMaxSlots = maxSlotsPerDate[appointmentDate];
      const maxSlots = dateSpecificMaxSlots !== undefined ? dateSpecificMaxSlots : (doctorData.maxSlots || 10);
      
      // Get unavailable time slots
      const unavailableTimeSlots = doctorData.availableSlots?.[appointmentDate] || [];
      const totalAvailableSlots = maxSlots - unavailableTimeSlots.length;
      
      // Get current bookings
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('status', '!=', 'cancelled')
      );
      
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const bookedCount = appointmentsSnapshot.size;
      
      console.log(`📊 Slot check for ${doctorName} on ${appointmentDate}:`);
      console.log(`   Total available slots: ${totalAvailableSlots}`);
      console.log(`   Booked: ${bookedCount}`);
      console.log(`   Has availability: ${bookedCount < totalAvailableSlots}`);
      
      return bookedCount < totalAvailableSlots;
    } catch (error) {
      console.error('Error checking slot availability:', error);
      return false;
    }
  }, []);

  const getAvailableTimeSlot = async (
    doctorName: string, 
    appointmentDate: string, 
    priorityLevel: string
  ): Promise<string | null> => {
    try {
      // Get booked slots
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('doctor', '==', doctorName),
        where('appointmentDate', '==', appointmentDate),
        where('status', '!=', 'cancelled')
      );
      
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const bookedSlots = appointmentsSnapshot.docs.map(doc => doc.data().timeSlot as string);
      
      // Get doctor's unavailable time slots
      const doctorsRef = collection(db, 'doctors');
      const doctorQuery = query(doctorsRef, where('name', '==', doctorName));
      const doctorSnapshot = await getDocs(doctorQuery);
      
      let unavailableTimeSlots: string[] = [];
      if (!doctorSnapshot.empty) {
        const doctorData = doctorSnapshot.docs[0].data();
        unavailableTimeSlots = doctorData.availableSlots?.[appointmentDate] || [];
      }
      
      // Generate time slots based on priority level
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
      
      // Find first available slot
      for (const slot of timeSlots) {
        if (!bookedSlots.includes(slot) && !unavailableTimeSlots.includes(slot)) {
          console.log('✅ Found available time slot:', slot);
          return slot;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting available time slot:', error);
      return null;
    }
  };

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
      
      // Sort by time chronologically
      appointments.sort((a, b) => {
        const [hoursA, minutesA] = a.timeSlot.split(':').map(Number);
        const [hoursB, minutesB] = b.timeSlot.split(':').map(Number);
        return (hoursA * 60 + minutesA) - (hoursB * 60 + minutesB);
      });
      
      // Update queue numbers
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
  
  const autoAssignToAppointment = useCallback(async (entry: WaitingListEntry) => {
    try {
      console.log('🔄 Auto-assigning', entry.fullName, 'to appointment...');
      
      // Get available time slot
      const timeSlot = await getAvailableTimeSlot(entry.doctor, entry.appointmentDate, entry.priorityLevel);
      
      if (!timeSlot) {
        console.log('❌ No available time slot found');
        return;
      }
      
      // Create appointment
      const appointmentsRef = collection(db, 'appointments');
      await addDoc(appointmentsRef, {
        fullName: entry.fullName,
        age: entry.age,
        photo: entry.photo,
        doctor: entry.doctor,
        appointmentDate: entry.appointmentDate,
        gender: entry.gender,
        medicalCondition: entry.medicalCondition,
        phone: entry.phone,
        priorityLevel: entry.priorityLevel,
        timeSlot: timeSlot,
        queueNumber: 0, // Will be recalculated
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        autoAssignedFromWaitingList: true
      });
      
      // Recalculate queue numbers
      await recalculateQueueNumbers(entry.appointmentDate);
      
      // Remove from waiting list
      const waitingListRef = doc(db, 'waitingList', entry.id);
      await deleteDoc(waitingListRef);
      
      toast.success(`✅ ${entry.fullName} has been automatically assigned to ${timeSlot}`, {
        autoClose: 5000,
        position: 'top-right'
      });
      
      console.log('✅ Successfully auto-assigned patient to appointment');
    } catch (error) {
      console.error('❌ Error auto-assigning to appointment:', error);
      toast.error('Failed to auto-assign patient');
    }
  }, []);

  // Auto-assign patients when slots become available
  useEffect(() => {
    const checkAndAutoAssign = async () => {
      if (waitingList.length === 0) return;

      console.log('🔍 Checking for available slots for', waitingList.length, 'waiting patients...');

      for (const entry of waitingList) {
        try {
          const hasAvailableSlot = await checkSlotAvailability(entry.doctor, entry.appointmentDate);
          
          if (hasAvailableSlot) {
            console.log('✅ Found available slot for', entry.fullName);
            await autoAssignToAppointment(entry);
            break; // Assign one at a time
          }
        } catch (error) {
          console.error('❌ Error checking availability for', entry.fullName, error);
        }
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkAndAutoAssign, 30000);
    
    // Also check immediately when list changes
    checkAndAutoAssign();

    return () => clearInterval(interval);
  }, [waitingList, checkSlotAvailability, autoAssignToAppointment]);

  const handleManualAssign = async () => {
    if (!selectedEntry) return;
    
    setIsProcessing(true);
    try {
      await autoAssignToAppointment(selectedEntry);
      setIsModalOpen(false);
      setSelectedEntry(null);
    } catch (error) {
      console.error('Error manually assigning:', error);
      toast.error('Failed to assign patient');
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
    } catch (error) {
      console.error('Error removing from waiting list:', error);
      toast.error('Failed to remove patient');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            </div>
            <div className="bg-white px-6 py-3 rounded-lg shadow-sm border border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Waiting</p>
                <p className="text-3xl font-bold text-indigo-600">{waitingList.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Automatic Assignment Enabled</p>
            <p className="text-sm text-blue-700 mt-1">
              Patients will be automatically assigned to appointments when slots become available. 
              The system checks every 30 seconds for openings.
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
                className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Patient Photo */}
                    {entry.photo ? (
                      <img
                        src={entry.photo}
                        alt={entry.fullName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200"
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
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-medium text-sm flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Assign Now
                    </button>
                    <button
                      onClick={() => handleRemoveFromWaitingList(entry.id)}
                      className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100  font-medium text-sm flex items-center gap-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Assign to Appointment</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedEntry(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to assign <strong>{selectedEntry.fullName}</strong> to an available appointment slot?
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  <strong>Doctor:</strong> {selectedEntry.doctor}<br />
                  <strong>Date:</strong> {formatDate(selectedEntry.appointmentDate)}<br />
                  <strong>Priority:</strong> {selectedEntry.priorityLevel.toUpperCase()}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedEntry(null);
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50  font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualAssign}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700  font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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