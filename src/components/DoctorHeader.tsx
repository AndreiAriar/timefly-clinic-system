import { useState, useRef } from 'react';
import { ChevronDown, Camera, LogOut, User, Calendar, Users, Home } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

interface DoctorHeaderProps {
  doctorName: string;
  username: string;
  profilePhoto?: string;
  userEmail: string;
  currentView: string;
  onViewChange: (view: 'home' | 'appointments' | 'queue') => void;
  onLogout: () => void;
  onPhotoChange: (photo: string) => void;
}

const DoctorHeader = ({ 
  doctorName, 
  username, 
  profilePhoto, 
  userEmail, 
  currentView, 
  onViewChange, 
  onLogout, 
  onPhotoChange 
}: DoctorHeaderProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localProfilePhoto, setLocalProfilePhoto] = useState(profilePhoto);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          // Very small dimensions - 80x80 for tiny base64
          const maxDimension = 80;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Draw image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with very low quality - target 20KB max
          let quality = 0.4;
          let result = canvas.toDataURL('image/jpeg', quality);
          
          // Target: under 20KB for base64 string
          const maxSizeKB = 20;
          
          while (result.length > maxSizeKB * 1024 && quality > 0.1) {
            quality -= 0.05;
            result = canvas.toDataURL('image/jpeg', quality);
          }
          
          console.log('📸 Final compressed size:', Math.round(result.length / 1024), 'KB');
          console.log('📸 Final quality:', quality);
          console.log('📸 Final dimensions:', width, 'x', height);
          
          if (result.length > maxSizeKB * 1024) {
            reject(new Error('Could not compress image to required size'));
            return;
          }
          
          resolve(result);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size too large. Please select an image under 5MB.', {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file.', {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      setIsUploading(true);

      // Show loading toast
      const loadingToast = toast.loading('Uploading profile photo...', {
        position: "top-right",
      });

      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('No authenticated user');
        }

        // Compress image with ultra-aggressive settings
        const compressedBase64 = await compressImage(file);

        // Update local state IMMEDIATELY for instant UI update
        setLocalProfilePhoto(compressedBase64);
        onPhotoChange(compressedBase64);

        // Update Firestore user document
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          photoURL: compressedBase64,
          updatedAt: new Date().toISOString()
        });

        // Try to update Firebase Auth profile
        try {
          await updateProfile(user, {
            photoURL: compressedBase64
          });
          console.log('✅ Auth profile updated successfully');
        } catch (authError: any) {
          // If Auth profile update fails, it's okay - we have it in Firestore
          console.warn('⚠️ Auth profile update failed (using Firestore instead):', authError.message);
        }

        // Close dropdown
        setIsDropdownOpen(false);

        // Update loading toast to success
        toast.update(loadingToast, {
          render: 'Profile photo updated successfully!',
          type: 'success',
          isLoading: false,
          autoClose: 3000,
        });

      } catch (error: any) {
        console.error('Error updating profile photo:', error);
        
        // Revert local state on error
        setLocalProfilePhoto(profilePhoto);
        
        // Update loading toast to error
        toast.update(loadingToast, {
          render: error.message === 'Could not compress image to required size' 
            ? 'Image is too large. Please try a smaller image.'
            : 'Failed to upload profile photo. Please try again.',
          type: 'error',
          isLoading: false,
          autoClose: 3000,
        });
      } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  // Sync local photo state with prop changes
  useState(() => {
    setLocalProfilePhoto(profilePhoto);
  });

  const handleLogoClick = () => {
    onViewChange('home');
    navigate('/doctor');
  };

  const navItems = [
    { key: 'home' as const, label: 'Home', icon: Home },
    { key: 'appointments' as const, label: 'Appointments', icon: Calendar },
    { key: 'queue' as const, label: 'Patient Queue', icon: Users },
  ];

  const handleNavigation = (view: 'home' | 'appointments' | 'queue') => {
    onViewChange(view);
    setIsDropdownOpen(false);
  };

  // Use local photo state for display
  const displayPhoto = localProfilePhoto || profilePhoto;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            {/* Logo and Title - Clickable */}
            <button
              onClick={handleLogoClick}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <img 
                src="/timefly_logo.png" 
                alt="TimeFly" 
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold text-gray-900">TimeFly</span>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.filter(item => item.key !== 'home').map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => onViewChange(item.key)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentView === item.key
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-1 hover:bg-gray-100 transition-colors"
            >
              <div className="relative">
                {displayPhoto ? (
                  <img
                    className="h-10 w-10 rounded-full object-cover border-2 border-gray-300"
                    src={displayPhoto}
                    alt="Profile"
                    style={{ imageRendering: 'auto' }}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-300">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </div>
              </div>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg py-2 z-50 border border-gray-200">
                {/* User Info Section */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    {displayPhoto ? (
                      <img
                        className="h-14 w-14 rounded-full object-cover border-2 border-gray-200"
                        src={displayPhoto}
                        alt="Profile"
                        style={{ imageRendering: 'auto' }}
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-200">
                        <User className="h-7 w-7 text-blue-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {doctorName}
                      </p>
                      <p className="text-xs text-gray-600 truncate font-medium">
                        {userEmail || 'No email available'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation in Dropdown */}
                <div className="md:hidden border-b border-gray-100">
                  {navItems.filter(item => item.key !== 'home').map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleNavigation(item.key)}
                        className={`flex items-center w-full px-4 py-3 text-sm transition-colors ${
                          currentView === item.key
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="h-4 w-4 mr-3" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown Actions */}
                <div className="py-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="h-4 w-4 mr-3" />
                    {isUploading ? 'Uploading...' : 'Change Photo'}
                  </button>
                  <button
                    onClick={() => {
                      onLogout();
                      setIsDropdownOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DoctorHeader;