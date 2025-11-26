import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Clock, User, AlertCircle } from 'lucide-react';

interface Appointment {
  id: string;
  fullName: string;
  doctor: string;
  appointmentDate: string;
  priorityLevel: string;
  timeSlot: string;
  queueNumber: number;
  email: string;
}

interface StaffRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onConfirm: (updatedData: { appointmentDate: string; timeSlot: string; rescheduleReason: string }) => Promise<void>;
  isSubmitting?: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface RescheduleOption {
  id: string;
  label: string;
  description: string;
  dateOffset?: number;
  timeSlot?: string;
}

const StaffRescheduleModal = ({ isOpen, onClose, appointment, onConfirm, isSubmitting = false }: StaffRescheduleModalProps) => {
  const [newDate, setNewDate] = useState(appointment.appointmentDate);
  const [newTimeSlot, setNewTimeSlot] = useState(appointment.timeSlot);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  const rescheduleOptions: RescheduleOption[] = [
    {
      id: 'doctor_unavailable',
      label: 'Doctor Unavailable',
      description: 'Original doctor is not available at the scheduled time'
    },
    {
      id: 'clinic_emergency',
      label: 'Clinic Emergency',
      description: 'Unexpected clinic closure or emergency situation'
    },
    {
      id: 'patient_requested',
      label: 'Patient Requested',
      description: 'Patient contacted to reschedule their appointment'
    },
    {
      id: 'overbooking',
      label: 'Schedule Conflict',
      description: 'Too many appointments scheduled at the same time'
    },
    {
      id: 'equipment_issue',
      label: 'Equipment Issue',
      description: 'Medical equipment requires maintenance or repair'
    },
    {
      id: 'next_available',
      label: 'Next Available Slot',
      description: 'Moving to next available time slot for better service'
    },
    {
      id: 'other',
      label: 'Other Reason',
      description: 'Specify a custom reason for rescheduling'
    }
  ];

  useEffect(() => {
    setNewDate(appointment.appointmentDate);
    setNewTimeSlot(appointment.timeSlot);
    setSelectedOption('');
    setCustomReason('');
  }, [appointment, isOpen]);

  const generateTimeSlots = useCallback(() => {
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
  }, [appointment.priorityLevel]);

  useEffect(() => {
    if (isOpen && newDate) {
      generateTimeSlots();
    }
  }, [isOpen, newDate, generateTimeSlots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOption) {
      return;
    }

    const finalReason = selectedOption === 'other' ? customReason : 
      rescheduleOptions.find(opt => opt.id === selectedOption)?.label || '';

    setIsSendingNotification(true);
    try {
      await onConfirm({
        appointmentDate: newDate,
        timeSlot: newTimeSlot,
        rescheduleReason: finalReason
      });
    } catch (error) {
      console.error('Error in reschedule process:', error);
    } finally {
      setIsSendingNotification(false);
    }
  };

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  const isProcessing = isSubmitting || isSendingNotification;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-reschedule-modal-title">
      {/* Transparent Background Overlay */}
      <div 
        className="fixed inset-0 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 id="staff-reschedule-modal-title" className="text-2xl font-bold text-white">Reschedule Appointment</h3>
                <p className="text-blue-100 text-sm mt-1">Staff - Manual Rescheduling</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition p-2 rounded-full hover:bg-white/10"
              aria-label="Close reschedule dialog"
              disabled={isProcessing}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Current Appointment Summary */}
          <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4 text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Current Appointment Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Patient</p>
                <p className="font-semibold text-gray-900 text-base">{appointment.fullName}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Queue #</p>
                <p className="font-semibold text-gray-900 text-base">#{appointment.queueNumber}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Doctor</p>
                <p className="font-semibold text-gray-900 text-base">{appointment.doctor}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Current Time</p>
                <p className="font-semibold text-gray-900 text-base">
                  {formatDate(appointment.appointmentDate)} at {convertTo12Hour(appointment.timeSlot)}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Reschedule Reason Section */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4 text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                Select Reschedule Reason
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rescheduleOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedOption === option.id
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="rescheduleReason"
                      value={option.id}
                      checked={selectedOption === option.id}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 mt-0.5 flex-shrink-0"
                      disabled={isProcessing}
                    />
                    <div className="ml-3 flex-1">
                      <span className="block text-sm font-medium text-gray-900">
                        {option.label}
                      </span>
                      <span className="block text-sm text-gray-500 mt-1">
                        {option.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Reason Input */}
            {selectedOption === 'other' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <label htmlFor="customReason" className="block text-sm font-medium text-gray-700 mb-2">
                  Please specify the reason for rescheduling *
                </label>
                <textarea
                  id="customReason"
                  name="customReason"
                  required
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter the specific reason for rescheduling this appointment..."
                  disabled={isProcessing}
                />
              </div>
            )}

            {/* New Date and Time Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Date Selection */}
              <div>
                <label htmlFor="newDate" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Select New Date *
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={isProcessing}
                />
              </div>

              {/* Time Slot Selection */}
              {availableTimeSlots.length > 0 && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Select New Time Slot *
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                    {availableTimeSlots.map((slot) => {
                      const displayTime = convertTo12Hour(slot.time);
                      
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available || isProcessing}
                          onClick={() => setNewTimeSlot(slot.time)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            newTimeSlot === slot.time
                              ? 'bg-blue-600 text-white shadow-sm'
                              : slot.available
                              ? 'bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-300 border border-gray-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            </div>

            {/* Important Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4" role="alert">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-blue-800 mb-1">Important Notice</h5>
                  <p className="text-sm text-blue-700">
                    Rescheduling this appointment will automatically notify the patient via email. 
                    The original time slot will be freed up for other patients.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedOption || !newTimeSlot || (selectedOption === 'other' && !customReason.trim()) || isProcessing}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                aria-busy={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Confirm Reschedule
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StaffRescheduleModal;