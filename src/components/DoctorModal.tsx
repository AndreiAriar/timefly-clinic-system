import { useState, useRef, useEffect } from 'react';
import { X, Camera, User } from 'lucide-react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

interface Doctor {
  id?: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  photo: string;
  isActive: boolean;
  createdAt?: string;
}

interface DoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDoctorAdded?: () => void;
  editDoctor?: Doctor | null;
}

const DoctorModal = ({ isOpen, onClose, onDoctorAdded, editDoctor }: DoctorModalProps) => {
  const [formData, setFormData] = useState<Omit<Doctor, 'id' | 'createdAt'>>({
    name: editDoctor?.name || '',
    specialty: editDoctor?.specialty || '',
    email: editDoctor?.email || '',
    phone: editDoctor?.phone || '',
    photo: editDoctor?.photo || '',
    isActive: editDoctor?.isActive !== undefined ? editDoctor.isActive : true
  });
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const specialties = [
    'Ophthalmology',
    'Optometry',
    'Retina Specialist',
    'Cornea Specialist',
    'Glaucoma Specialist',
    'Pediatric Ophthalmology',
    'Oculoplastics',
    'Neuro-ophthalmology',
    'Other (Please Specify)'
  ];

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    setFormData(prev => ({ ...prev, phone: value }));
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (phone.length === 0) return false;
    if (phone.length !== 11) return false;
    return phone.startsWith('09');
  };

  const handleSpecialtyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, specialty: value }));
    
    if (value !== 'Other (Please Specify)') {
      setCustomSpecialty('');
    }
  };

  const handleCustomSpecialtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomSpecialty(value);
    setFormData(prev => ({ ...prev, specialty: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhoneNumber(formData.phone)) {
      toast.error('Please enter a valid 11-digit Philippine mobile number starting with 09');
      return;
    }

    if (formData.specialty === 'Other (Please Specify)' && !customSpecialty.trim()) {
      toast.error('Please specify the specialty');
      return;
    }

    setIsLoading(true);

    try {
      const finalSpecialty = formData.specialty === 'Other (Please Specify)' ? customSpecialty : formData.specialty;

      if (editDoctor?.id) {
        const doctorRef = doc(db, 'doctors', editDoctor.id);
        await updateDoc(doctorRef, {
          ...formData,
          specialty: finalSpecialty,
          updatedAt: new Date().toISOString()
        });
        toast.success('Doctor updated successfully!');
      } else {
        const doctorData = {
          ...formData,
          specialty: finalSpecialty,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'doctors'), doctorData);
        
        toast.success(`Doctor added successfully! Invitation email sent to ${formData.email}`);
      }

      if (onDoctorAdded) {
        onDoctorAdded();
      }
      
      onClose();
      setFormData({
        name: '',
        specialty: '',
        email: '',
        phone: '',
        photo: '',
        isActive: true
      });
      setCustomSpecialty('');
    } catch (error) {
      console.error('Error saving doctor:', error);
      toast.error('Failed to save doctor. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !editDoctor) {
      setFormData({
        name: '',
        specialty: '',
        email: '',
        phone: '',
        photo: '',
        isActive: true
      });
      setCustomSpecialty('');
    }
  }, [isOpen, editDoctor]);

  if (!isOpen) return null;

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
            <h3 className="text-2xl font-bold text-white">
              {editDoctor ? 'Edit Doctor' : 'Add New Doctor'}
            </h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6">
          <div className="text-center mb-6">
            <div className="relative inline-block">
              {formData.photo ? (
                <img
                  src={formData.photo}
                  alt="Doctor preview"
                  className="w-32 h-32 rounded-full object-cover border-4 border-indigo-200"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-indigo-100 border-4 border-indigo-200 flex items-center justify-center">
                  <User className="w-16 h-16 text-indigo-400" />
                </div>
              )}
              <button
                type="button"
                onClick={handleChangePhotoClick}
                className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <p className="text-sm text-gray-500 mt-2">Click camera icon to upload photo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Doctor Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter doctor's full name"
              />
            </div>

            <div>
              <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
                Specialty *
              </label>
              <select
                id="specialty"
                required
                value={formData.specialty}
                onChange={handleSpecialtyChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select Specialty</option>
                {specialties.map(specialty => (
                  <option key={specialty} value={specialty}>{specialty}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.specialty === 'Other (Please Specify)' && (
            <div className="mb-4">
              <label htmlFor="customSpecialty" className="block text-sm font-medium text-gray-700 mb-1">
                Please Specify Specialty *
              </label>
              <input
                type="text"
                id="customSpecialty"
                required
                value={customSpecialty}
                onChange={handleCustomSpecialtyChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter specialty"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="doctor@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">+63</span>
                </div>
                <input
                  type="tel"
                  id="phone"
                  required
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="912 345 6789"
                  maxLength={11}
                />
              </div>
              {formData.phone && !validatePhoneNumber(formData.phone) && (
                <p className="text-xs text-red-500 mt-1">
                  Must be 11 digits starting with 09
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : editDoctor ? 'Update Doctor' : 'Add Doctor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DoctorModal;