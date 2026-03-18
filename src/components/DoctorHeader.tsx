import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Camera, LogOut, User, Calendar, Users, Home, Snowflake } from 'lucide-react';
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
  onToggleChristmasTheme: () => void; // Add this prop
  isChristmasTheme: boolean; // Add this prop
}

const DoctorHeader = ({ 
  doctorName, 
  profilePhoto, 
  userEmail, 
  currentView, 
  onViewChange, 
  onLogout, 
  onPhotoChange,
  onToggleChristmasTheme, // Add this prop
  isChristmasTheme // Add this prop
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
          
          // Increased dimensions for better quality - 200x200
          const maxDimension = 200;
          let width = img.width;
          let height = img.height;
          
          // Maintain aspect ratio while resizing
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
          
          // Enable high-quality image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw image with better quality
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with higher quality - target 100KB max for better clarity
          let quality = 0.8;
          let result = canvas.toDataURL('image/jpeg', quality);
          
          // Target: under 100KB for base64 string (increased from 20KB)
          const maxSizeKB = 100;
          
          // Only compress if absolutely necessary
          while (result.length > maxSizeKB * 1024 && quality > 0.5) {
            quality -= 0.1;
            result = canvas.toDataURL('image/jpeg', quality);
          }
          
          console.log('📸 Final compressed size:', Math.round(result.length / 1024), 'KB');
          console.log('📸 Final quality:', quality);
          console.log('📸 Final dimensions:', width, 'x', height);
          
          if (result.length > maxSizeKB * 1024) {
            // If still too large, use the best quality we can get
            result = canvas.toDataURL('image/jpeg', 0.5);
            console.log('⚠️ Using fallback quality 0.5');
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
      // Increased file size limit to 10MB for higher quality images
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size too large. Please select an image under 10MB.', {
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

        // Compress image with better quality settings
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
        } catch (authError: unknown) {
          // If Auth profile update fails, it's okay - we have it in Firestore
          const errorMessage = authError instanceof Error ? authError.message : 'Unknown error occurred';
          console.warn('⚠️ Auth profile update failed (using Firestore instead):', errorMessage);
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

      } catch (error: unknown) {
        console.error('Error updating profile photo:', error);
        
        // Revert local state on error
        setLocalProfilePhoto(profilePhoto);
        
        // Update loading toast to error
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload profile photo. Please try again.';
        toast.update(loadingToast, {
          render: errorMessage === 'Could not compress image to required size' 
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
  useEffect(() => {
    setLocalProfilePhoto(profilePhoto);
  }, [profilePhoto]);

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
    <header className="bg-blue-600 shadow-sm">
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
                src="/cliniqueue.jpg" 
                alt="CliniQueue" 
                className="h-10 w-auto filter brightness-0 invert"
              />
              <span className="text-xl font-bold text-white">CliniQueue</span>
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
                        ? 'bg-blue-500 text-white'
                        : 'text-blue-100 hover:text-white hover:bg-blue-500'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-white" />
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
              className="flex items-center space-x-2 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 p-1 hover:bg-blue-500 transition-colors"
            >
              <div className="relative">
                {displayPhoto ? (
                  <img
                    className="h-10 w-10 rounded-full object-cover border-2 border-blue-300"
                    src={displayPhoto}
                    alt="Profile"
                    style={{ imageRendering: 'auto' }}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-blue-400 flex items-center justify-center border-2 border-blue-300">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5">
                  <ChevronDown className="h-3 w-3 text-white" />
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
                        <Icon className="h-4 w-4 mr-3 text-gray-700" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown Actions */}
                <div className="py-1">
                  {/* Christmas Theme Toggle Button */}
                  <button
                    onClick={() => {
                      onToggleChristmasTheme();
                      setIsDropdownOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Snowflake className={`h-4 w-4 mr-3 ${isChristmasTheme ? 'text-red-500' : 'text-gray-700'}`} />
                    {isChristmasTheme ? 'Merry Christmas' : 'Feliz Navidad'} 
                  </button>

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
                    <Camera className="h-4 w-4 mr-3 text-gray-700" />
                    {isUploading ? 'Uploading...' : 'Change Photo'}
                  </button>
                  <button
                    onClick={() => {
                      onLogout();
                      setIsDropdownOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-3 text-gray-700" />
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