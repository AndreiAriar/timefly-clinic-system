import { useState, useEffect } from 'react';
import { X, Users, Calendar, Clock, ArrowRight, ArrowLeft, Eye } from 'lucide-react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase/config';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  photo: string;
  isActive: boolean;
  maxSlots: number;
  availableSlots: { [date: string]: string[] };
}

interface Appointment {
  id: string;
  doctor: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
}

const CalendarWizardModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadDoctors();
      loadAppointments();
    }
  }, [isOpen]);

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

  const loadDoctors = async () => {
    try {
      const doctorsRef = collection(db, 'doctors');
      const q = query(doctorsRef, where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      
      const doctorsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        maxSlots: 10,
        availableSlots: {},
        ...doc.data()
      })) as Doctor[];
      
      setDoctors(doctorsData);
    } catch (error) {
      console.error('Error loading doctors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAppointments = async () => {
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef);
      const querySnapshot = await getDocs(q);
      
      const appointmentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];
      
      setAppointments(appointmentsData);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };

  const getBookedSlotsForDoctor = (doctorName: string, date: string) => {
    return appointments.filter(
      apt => apt.doctor === doctorName && 
             apt.appointmentDate === date && 
             apt.status !== 'cancelled'
    ).map(apt => apt.timeSlot);
  };

  const getAvailableSlotsForDoctor = (doctor: Doctor, date: string) => {
    const bookedSlots = getBookedSlotsForDoctor(doctor.name, date);
    const manuallyUnavailable = doctor.availableSlots?.[date] || [];
    const allSlots = generateTimeSlots();
    
    return allSlots.filter(slot => 
      !bookedSlots.includes(slot) && 
      manuallyUnavailable.includes(slot)
    );
  };

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

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const totalSlots = doctors.reduce((sum, doctor) => sum + (doctor.maxSlots || 10), 0);
  const totalBookedSlots = appointments.filter(
    apt => apt.appointmentDate === selectedDate && apt.status !== 'cancelled'
  ).length;
  const totalAvailableSlots = totalSlots - totalBookedSlots;

  const handleClose = () => {
    setCurrentStep(1);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedDoctor(null);
    onClose();
  };

  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => prev - 1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        ></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative z-[101]">
          {/* Header */}
          <div className="bg-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6 text-white" />
                <h3 className="text-2xl font-bold text-white">
                  {currentStep === 1 && 'View Calendar Overview'}
                  {currentStep === 2 && 'Select a Doctor'}
                  {currentStep === 3 && 'Doctor Availability'}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Progress Steps */}
            <div className="flex justify-center mt-4">
              <div className="flex items-center">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === currentStep
                        ? 'bg-white text-indigo-600'
                        : step < currentStep
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {step}
                    </div>
                    {step < 3 && (
                      <div className={`w-12 h-1 mx-2 ${
                        step < currentStep ? 'bg-green-500' : 'bg-gray-300'
                      }`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-8 max-h-[calc(100vh-200px)] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading calendar...</p>
              </div>
            ) : (
              <>
                {/* Step 1: Calendar Overview */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">Calendar Overview</h4>
                      <p className="text-gray-600">View total availability and select a date</p>
                    </div>

                    {/* Date Selector */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        <label htmlFor="wizardDate" className="text-sm font-medium text-gray-700">
                          Select Date:
                        </label>
                        <input
                          type="date"
                          id="wizardDate"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>

                      {/* Total Slots Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 text-center border">
                          <Users className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Total Capacity</p>
                          <p className="text-2xl font-bold text-gray-900">{totalSlots}</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center border">
                          <Clock className="w-8 h-8 text-green-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Available Slots</p>
                          <p className="text-2xl font-bold text-gray-900">{totalAvailableSlots}</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center border">
                          <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Active Doctors</p>
                          <p className="text-2xl font-bold text-gray-900">{doctors.length}</p>
                        </div>
                      </div>
                    </div>

                    {/* Doctors Summary */}
                    <div className="bg-white rounded-lg border p-6">
                      <h5 className="text-lg font-semibold text-gray-900 mb-4">Doctors Summary</h5>
                      <div className="space-y-3">
                        {doctors.map(doctor => {
                          const bookedSlots = getBookedSlotsForDoctor(doctor.name, selectedDate).length;
                          const maxSlots = doctor.maxSlots || 10;
                          const availableSlots = maxSlots - bookedSlots;
                          
                          return (
                            <div key={doctor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                {doctor.photo ? (
                                  <img
                                    src={doctor.photo}
                                    alt={`Dr. ${doctor.name}`}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-indigo-600" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">Dr. {doctor.name}</p>
                                  <p className="text-sm text-gray-600">{doctor.specialty}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">
                                  {bookedSlots}/{maxSlots} slots
                                </p>
                                <p className={`text-sm ${
                                  availableSlots <= 0 
                                    ? 'text-red-600' 
                                    : availableSlots <= 3 
                                    ? 'text-orange-600'
                                    : 'text-green-600'
                                }`}>
                                  {availableSlots <= 0 ? 'Fully Booked' : `${availableSlots} available`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={nextStep}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2"
                      >
                        Next
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Select Doctor */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">Select a Doctor</h4>
                      <p className="text-gray-600">Choose a doctor to view their detailed availability</p>
                    </div>

                    <div className="grid gap-4">
                      {doctors.map(doctor => {
                        const bookedSlots = getBookedSlotsForDoctor(doctor.name, selectedDate).length;
                        const maxSlots = doctor.maxSlots || 10;
                        const availableSlots = maxSlots - bookedSlots;
                        
                        return (
                          <button
                            key={doctor.id}
                            onClick={() => {
                              setSelectedDoctor(doctor);
                              nextStep();
                            }}
                            className="w-full p-4 bg-white border border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                {doctor.photo ? (
                                  <img
                                    src={doctor.photo}
                                    alt={`Dr. ${doctor.name}`}
                                    className="w-16 h-16 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <Users className="w-8 h-8 text-indigo-600" />
                                  </div>
                                )}
                                <div>
                                  <h5 className="text-lg font-semibold text-gray-900">Dr. {doctor.name}</h5>
                                  <p className="text-indigo-600">{doctor.specialty}</p>
                                  <p className="text-sm text-gray-600">{doctor.email}</p>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  availableSlots <= 0 
                                    ? 'bg-red-100 text-red-800' 
                                    : availableSlots <= 3 
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {availableSlots <= 0 ? 'Fully Booked' : `${availableSlots} Available`}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                  {bookedSlots}/{maxSlots} slots booked
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={prevStep}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition flex items-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Doctor Availability */}
                {currentStep === 3 && selectedDoctor && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">Doctor Availability</h4>
                      <p className="text-gray-600">
                        Available time slots for Dr. {selectedDoctor.name} on {selectedDate}
                      </p>
                    </div>

                    {/* Doctor Info */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="flex items-center gap-4">
                        {selectedDoctor.photo ? (
                          <img
                            src={selectedDoctor.photo}
                            alt={`Dr. ${selectedDoctor.name}`}
                            className="w-20 h-20 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Users className="w-10 h-10 text-indigo-600" />
                          </div>
                        )}
                        <div>
                          <h5 className="text-xl font-bold text-gray-900">Dr. {selectedDoctor.name}</h5>
                          <p className="text-indigo-600 font-semibold">{selectedDoctor.specialty}</p>
                          <p className="text-gray-600">{selectedDoctor.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Available Time Slots */}
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-4">Available Time Slots</h5>
                      <div className="grid grid-cols-3 gap-3">
                        {getAvailableSlotsForDoctor(selectedDoctor, selectedDate).map((timeSlot) => (
                          <div
                            key={timeSlot}
                            className="p-4 bg-green-50 border border-green-200 rounded-lg text-center"
                          >
                            <Clock className="w-5 h-5 text-green-600 mx-auto mb-2" />
                            <p className="font-semibold text-green-700">{convertTo12Hour(timeSlot)}</p>
                            <p className="text-xs text-green-600 mt-1">Available</p>
                          </div>
                        ))}
                      </div>

                      {getAvailableSlotsForDoctor(selectedDoctor, selectedDate).length === 0 && (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600">No available time slots for this date.</p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={prevStep}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition flex items-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Doctors
                      </button>
                      <button
                        onClick={handleClose}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarWizardModal;