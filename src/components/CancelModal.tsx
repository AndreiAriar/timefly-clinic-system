import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Appointment {
  id: string;
  fullName: string;
  doctor: string;
  appointmentDate: string;
  timeSlot: string;
  queueNumber: number;
}

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onConfirm: (reason: string) => void;
}

const CancelModal = ({ isOpen, onClose, appointment, onConfirm }: CancelModalProps) => {
  const [cancelReason, setCancelReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');

  const predefinedReasons = [
    'Schedule conflict',
    'Feeling better',
    'Doctor unavailable',
    'Personal emergency',
    'Financial reasons',
    'Other'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'Other' ? cancelReason : selectedReason;
    onConfirm(finalReason);
    setCancelReason('');
    setSelectedReason('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <div 
        className="fixed inset-0 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      
      <div 
        className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-red-500 to-red-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 id="cancel-modal-title" className="text-2xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
              Cancel Appointment
            </h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition"
              aria-label="Close cancel appointment dialog"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Appointment Details</h4>
            <div className="space-y-1 text-sm">
              <p className="text-gray-600">
                <span className="font-medium text-gray-900">Patient:</span> {appointment.fullName}
              </p>
              <p className="text-gray-600">
                <span className="font-medium text-gray-900">Queue Number:</span> #{appointment.queueNumber}
              </p>
              <p className="text-gray-600">
                <span className="font-medium text-gray-900">Doctor:</span> {appointment.doctor}
              </p>
              <p className="text-gray-600">
                <span className="font-medium text-gray-900">Date & Time:</span> {new Date(appointment.appointmentDate).toLocaleDateString()} at {appointment.timeSlot}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-3">
                Reason for Cancellation <span className="text-red-500">*</span>
              </legend>
              <div className="space-y-2">
                {predefinedReasons.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${
                      selectedReason === reason
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-4 h-4 text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-3 text-gray-700">{reason}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {selectedReason === 'Other' && (
              <div>
                <label htmlFor="customReason" className="block text-sm font-medium text-gray-700 mb-2">
                  Please specify your reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="customReason"
                  name="customReason"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Please provide details about your cancellation reason..."
                />
              </div>
            )}

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h5 className="text-sm font-medium text-red-800 mb-1">Warning</h5>
                  <p className="text-sm text-red-700">
                    This action cannot be undone. You will need to book a new appointment if you wish to see the doctor again.
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
                Keep Appointment
              </button>
              <button
                type="submit"
                disabled={!selectedReason || (selectedReason === 'Other' && !cancelReason.trim())}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Cancel Appointment
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CancelModal;