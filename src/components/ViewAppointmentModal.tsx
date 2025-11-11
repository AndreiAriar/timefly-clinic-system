import { X, Calendar, User, FileText, AlertCircle } from 'lucide-react';

interface Appointment {
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
  timeSlot: string;
  queueNumber: number;
  status: string;
  createdAt: string;
  cancelReason?: string;
}

interface ViewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
}

const ViewAppointmentModal = ({ isOpen, onClose, appointment }: ViewAppointmentModalProps) => {
  if (!isOpen) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-green-100 text-green-800';
      case 'rescheduled': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div 
        className="fixed inset-0 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      
      <div 
        className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-2xl font-bold text-white">Appointment Details</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition"
              aria-label="Close appointment details"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="text-center mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-gray-600 mb-1">Queue Number</p>
            <p className="text-4xl font-bold text-indigo-600">#{appointment.queueNumber}</p>
          </div>

          <section className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              Patient Information
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-4">
                {appointment.photo ? (
                  <img
                    src={appointment.photo}
                    alt="Patient profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-indigo-600"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
                    <User className="w-10 h-10 text-indigo-600" aria-hidden="true" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900 text-lg">{appointment.fullName}</p>
                  <p className="text-gray-600">{appointment.age} years old • {appointment.gender}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              Appointment Information
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Doctor</p>
                  <p className="font-medium text-gray-900">{appointment.doctor}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Time</p>
                  <p className="font-medium text-gray-900">{appointment.timeSlot}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Phone</p>
                  <p className="font-medium text-gray-900">{appointment.phone}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Priority Level</p>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  {appointment.priorityLevel.charAt(0).toUpperCase() + appointment.priorityLevel.slice(1)}
                </span>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              Medical Condition
            </h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{appointment.medicalCondition}</p>
            </div>
          </section>

          {appointment.status === 'cancelled' && appointment.cancelReason && (
            <section className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
                Cancellation Reason
              </h4>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-gray-700">{appointment.cancelReason}</p>
              </div>
            </section>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Booked on: {new Date(appointment.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewAppointmentModal;