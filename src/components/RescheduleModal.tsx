import { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';

interface Appointment {
  id: string;
  fullName: string;
  doctor: string;
  appointmentDate: string;
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
}

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onConfirm: (updatedData: { appointmentDate: string; timeSlot: string }) => void | Promise<void>;
  isSubmitting?: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const RescheduleModal = ({ isOpen, onClose, appointment, onConfirm, isSubmitting = false }: RescheduleModalProps) => {
  const [newDate, setNewDate] = useState(appointment.appointmentDate);
  const [newTimeSlot, setNewTimeSlot] = useState(appointment.timeSlot);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);

  useEffect(() => {
    setNewDate(appointment.appointmentDate);
    setNewTimeSlot(appointment.timeSlot);
  }, [appointment]);

  useEffect(() => {
    if (isOpen && newDate) {
      generateTimeSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, newDate, appointment.priorityLevel]);

  const generateTimeSlots = () => {
    const slots: TimeSlot[] = [];
    const startHour = 8;
    const endHour = 16;

    let interval = 60;
    if (appointment.priorityLevel === 'emergency') {
      interval = 15;
    } else if (appointment.priorityLevel === 'urgent') {
      interval = 30;
    }

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({
          time: timeString,
          available: Math.random() > 0.3
        });
      }
    }

    setAvailableTimeSlots(slots);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      appointmentDate: newDate,
      timeSlot: newTimeSlot
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reschedule-modal-title">
      <div 
        className="fixed inset-0 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      
      <div 
        className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-yellow-500 to-orange-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 id="reschedule-modal-title" className="text-2xl font-bold text-white">Reschedule Appointment</h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition"
              aria-label="Close reschedule dialog"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Current Appointment</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500">Patient:</p>
                <p className="font-medium text-gray-900">{appointment.fullName}</p>
              </div>
              <div>
                <p className="text-gray-500">Doctor:</p>
                <p className="font-medium text-gray-900">{appointment.doctor}</p>
              </div>
              <div>
                <p className="text-gray-500">Date:</p>
                <p className="font-medium text-gray-900">
                  {new Date(appointment.appointmentDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Time:</p>
                <p className="font-medium text-gray-900">{appointment.timeSlot}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="newDate" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                Select New Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="newDate"
                name="newDate"
                required
                min={new Date().toISOString().split('T')[0]}
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  setNewTimeSlot('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>

            {availableTimeSlots.length > 0 && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                  Select New Time Slot <span className="text-red-500">*</span>
                </label>
               <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg" role="group" aria-label="Available time slots">
              {availableTimeSlots.map((slot) => {
                // Convert 24-hour format to 12-hour format with AM/PM
                const [hours, minutes] = slot.time.split(':').map(Number);
                const period = hours >= 12 ? 'PM' : 'AM';
                const hours12 = hours % 12 || 12;
                const displayTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
                
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setNewTimeSlot(slot.time)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      newTimeSlot === slot.time
                        ? 'bg-yellow-600 text-white'
                        : slot.available
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                    aria-label={`Time slot ${displayTime}${!slot.available ? ' (unavailable)' : ''}`}
                    aria-pressed={newTimeSlot === slot.time ? "true" : "false"}
                  >
                    {displayTime}
                  </button>
                );
              })}
            </div>
            </div>
            )}

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg" role="alert">
              <div className="flex gap-2">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-yellow-800 mb-1">Important</h5>
                  <p className="text-sm text-yellow-700">
                  Rescheduling this appointment will update the patient’s appointment details. Please remind the patient to arrive 15 minutes before the new scheduled time.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTimeSlot || isSubmitting}
                className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                aria-busy={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Confirm Reschedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;