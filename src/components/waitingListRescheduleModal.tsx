import { useState } from 'react';
import { X, Calendar, Clock, User, AlertCircle, Stethoscope } from 'lucide-react';
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

interface WaitingListRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  waitingListEntry: WaitingListEntry;
  onConfirm: (entryId: string, rescheduleData: { reason: string; customReason?: string }) => Promise<void>;
  isSubmitting: boolean;
}

const WaitingListRescheduleModal = ({
  isOpen,
  onClose,
  waitingListEntry,
  onConfirm,
  isSubmitting
}: WaitingListRescheduleModalProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  const rescheduleReasons = [
    { id: 'doctor-unavailable', label: 'Doctor unavailable on requested date' },
    { id: 'no-slots-available', label: 'No available slots for preferred date' },
    { id: 'patient-requested-change', label: 'Patient requested date change' },
    { id: 'emergency-closure', label: 'Emergency clinic closure' },
    { id: 'equipment-issue', label: 'Equipment maintenance/issues' },
    { id: 'other', label: 'Other reason' }
  ];

  const handleConfirm = async () => {
    if (!selectedReason) {
      toast.error('Please select a reschedule reason');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      toast.error('Please provide a reason for rescheduling');
      return;
    }

    try {
      await onConfirm(waitingListEntry.id, {
        reason: selectedReason,
        customReason: selectedReason === 'other' ? customReason : undefined
      });
      
      // Reset form
      setSelectedReason('');
      setCustomReason('');
    } catch {
      // Error handling is done in the parent component
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    onClose();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reschedule Waiting List Entry</h2>
            <p className="text-sm text-gray-600 mt-1">Select reason for rescheduling</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Patient Info */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            {waitingListEntry.photo ? (
              <img
                src={waitingListEntry.photo}
                alt={waitingListEntry.fullName}
                className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200">
                <User className="w-6 h-6 text-indigo-600" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{waitingListEntry.fullName}</h3>
              <p className="text-sm text-gray-600">{waitingListEntry.age} years old, {waitingListEntry.gender}</p>
            </div>
          </div>
          
          {/* Updated: Better aligned doctor and date info */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-700">Appointment Date: {formatDate(waitingListEntry.appointmentDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-700">Doctor: {waitingListEntry.doctor}</span>
            </div>
          </div>
          
          {waitingListEntry.preferredTimeSlot && (
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>Preferred Time: {waitingListEntry.preferredTimeSlot}</span>
            </div>
          )}
        </div>

        {/* Reschedule Reasons */}
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Reschedule Reason *
            </label>
            <div className="space-y-2">
              {rescheduleReasons.map((reason) => (
                <label
                  key={reason.id}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="rescheduleReason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Reason Input */}
          {selectedReason === 'other' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Please specify the reason *
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter the reason for rescheduling..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">What happens next?</p>
                <p className="text-sm text-blue-700 mt-1">
                  The patient will be notified about the reschedule and their position in the waiting list will be updated.
                  An email will be sent if the patient provided an email address.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || !selectedReason || (selectedReason === 'other' && !customReason.trim())}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : 'Confirm Reschedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingListRescheduleModal;