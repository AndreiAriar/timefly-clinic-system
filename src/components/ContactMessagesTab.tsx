import { useState, useEffect } from 'react';
import { Send, MoreVertical, Edit, Trash2, User, Search, CheckCircle, ArrowLeft, X, MessageCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, updateDoc, doc, where, getDoc, getDocs, writeBatch, limit } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'patient' | 'staff';
  message: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  participants: string[];
  isDeleted?: boolean;
}

interface PatientProfile {
  patientId: string;
  patientName: string;
  lastMessage: string;
  lastMessageTime: Timestamp;
  unreadCount: number;
  photoURL?: string;
}

interface UserData {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'patient' | 'staff';
  displayName?: string;
  photoURL?: string;
}

interface FirestoreUserData {
  displayName?: string;
  email?: string;
  role?: string;
  uid?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  userType?: string;
}

interface FirestoreMessageData {
  senderId: string;
  senderName: string;
  senderType: 'patient' | 'staff';
  message: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  participants: string[];
  isDeleted?: boolean;
}

const SupportMessages = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [patientProfiles, setPatientProfiles] = useState<PatientProfile[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [conversationDropdown, setConversationDropdown] = useState(false);
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPatientData, setSelectedPatientData] = useState<FirestoreUserData | null>(null);

  // Check authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Fetch user data from Firestore
        await fetchUserData(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch user data from Firestore
  const fetchUserData = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as FirestoreUserData;
        setUserData({
          uid: userDoc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          userType: (data.userType as 'patient' | 'staff') || 'staff',
          displayName: data.displayName || '',
          photoURL: data.photoURL || ''
        });
      }
    } catch {
      console.debug('Error fetching user data');
    }
  };

  // Fetch selected patient's data from Firestore
  const fetchSelectedPatientData = async (patientId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', patientId));
      if (userDoc.exists()) {
        const data = userDoc.data() as FirestoreUserData;
        setSelectedPatientData(data);
      } else {
        setSelectedPatientData(null);
      }
    } catch {
      setSelectedPatientData(null);
    }
  };

  // Enhanced function to get user profile with proper Firestore fields and error handling
  const getUserProfileData = async (userId: string): Promise<{ name: string; photoURL: string }> => {
    try {
      // Try to get user document directly
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const data = userDoc.data() as FirestoreUserData;
        
        // Use displayName first, then fall back to other fields
        const name = data.displayName || 
                    `${data.firstName || ''} ${data.lastName || ''}`.trim() || 
                    data.email || 
                    'Patient';
        
        const photoURL = data.photoURL || '';
        
        return { name, photoURL };
      }
      
      // If no user document found, try alternative approach without complex query
      try {
        // Simple query without multiple where clauses to avoid BloomFilterError
        const messagesRef = collection(db, 'supportMessages');
        const userMessagesQuery = query(
          messagesRef,
          where('senderId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(1) // Only get the most recent message
        );
        
        const querySnapshot = await getDocs(userMessagesQuery);
        if (!querySnapshot.empty) {
          const latestMessage = querySnapshot.docs[0].data() as FirestoreMessageData;
          // Only use message data if it's not deleted
          if (!latestMessage.isDeleted) {
            return {
              name: latestMessage.senderName,
              photoURL: ''
            };
          }
        }
      } catch {
        // Silently handle query errors, don't log to console
        console.debug('Message query failed, using default patient data');
      }
      
      return { name: 'Patient', photoURL: '' };
      
    } catch {
      // Don't log error to console to avoid the "No user document found" message
      return { name: 'Patient', photoURL: '' };
    }
  };

  // Load patient profiles - Fixed query for staff access
  useEffect(() => {
    let mounted = true;
    
    const loadProfiles = async () => {
      try {
        const messagesRef = collection(db, 'supportMessages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'));
        
        const querySnapshot = await getDocs(q);
        if (!mounted) return;
        
        const profilesMap = new Map();
        
        for (const docSnapshot of querySnapshot.docs) {
          const data = docSnapshot.data() as FirestoreMessageData;
          
          // Find patient messages to build profiles
          if (data.senderType === 'patient' && !data.isDeleted) {
            const patientId = data.senderId;
            
            if (!profilesMap.has(patientId)) {
              // Use senderName from message as primary source, only fetch user data if needed
              let patientName = data.senderName;
              let patientPhotoURL = '';
              
              // Always fetch user data to get the photo URL for chat list
              const profileData = await getUserProfileData(patientId);
              patientName = profileData.name;
              patientPhotoURL = profileData.photoURL;
              
              profilesMap.set(patientId, {
                patientId,
                patientName,
                lastMessage: data.message,
                lastMessageTime: data.createdAt,
                unreadCount: 0,
                photoURL: patientPhotoURL
              });
            }
          }
        }
        
        if (mounted) {
          setPatientProfiles(Array.from(profilesMap.values()));
        }
      } catch {
        console.debug('Error in patient profiles subscription');
      }
    };
    
    loadProfiles();
    
    // Set up real-time listener for new messages
    const messagesRef = collection(db, 'supportMessages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      if (!mounted) return;
      
      const profilesMap = new Map();
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data() as FirestoreMessageData;
        
        if (data.senderType === 'patient' && !data.isDeleted) {
          const patientId = data.senderId;
          
          if (!profilesMap.has(patientId)) {
            // Always fetch user data to ensure we have the photo URL
            const profileData = await getUserProfileData(patientId);
            
            profilesMap.set(patientId, {
              patientId,
              patientName: profileData.name,
              lastMessage: data.message,
              lastMessageTime: data.createdAt,
              unreadCount: 0,
              photoURL: profileData.photoURL // Now includes photo URL from user data
            });
          }
        }
      }
      
      if (mounted) {
        setPatientProfiles(Array.from(profilesMap.values()));
      }
    }, () => {
      console.debug('Error in patient profiles listener');
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Load messages for selected patient - Fixed query
  useEffect(() => {
    if (!selectedPatient) {
      setChatMessages([]);
      setSelectedPatientData(null);
      return;
    }

    // Fetch patient data when patient is selected
    fetchSelectedPatientData(selectedPatient);

    const messagesRef = collection(db, 'supportMessages');
    const q = query(
      messagesRef, 
      where('participants', 'array-contains', selectedPatient),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData: ChatMessage[] = querySnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as FirestoreMessageData;
        return {
          id: docSnapshot.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderType: data.senderType,
          message: data.message,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          participants: data.participants,
          isDeleted: data.isDeleted || false
        };
      });
      setChatMessages(messagesData);
    });

    return () => unsubscribe();
  }, [selectedPatient]);

  // Check if current user can edit/delete a message
  const canEditMessage = (message: ChatMessage): boolean => {
    if (!currentUser) return false;
    return message.senderId === currentUser.uid;
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedPatient) return;

    setLoading(true);
    try {
      if (editingMessage) {
        // Update existing message - only if user owns it
        if (!canEditMessage(editingMessage)) {
          alert('You can only edit your own messages.');
          return;
        }

        const messageRef = doc(db, 'supportMessages', editingMessage.id);
        await updateDoc(messageRef, {
          message: message,
          updatedAt: serverTimestamp()
        });
        setEditingMessage(null);
        setShowSuccess(true);
      } else {
        // Send new message with staff member's actual name
        const staffName = userData ? `${userData.firstName} ${userData.lastName}`.trim() : 'Support Team';
        if (staffName === ' ') {
          return;
        }
        
        await addDoc(collection(db, 'supportMessages'), {
          senderId: currentUser?.uid || 'staff',
          senderName: staffName,
          senderType: 'staff',
          message: message,
          participants: [selectedPatient, currentUser?.uid || 'staff'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDeleted: false
        });
        setShowSuccess(true);
      }
      setMessage('');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch {
      alert('There was an error sending your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string, message: ChatMessage) => {
    // Check if user owns the message before deleting
    if (!canEditMessage(message)) {
      alert('You can only delete your own messages.');
      return;
    }

    try {
      const messageRef = doc(db, 'supportMessages', messageId);
      await updateDoc(messageRef, {
        isDeleted: true,
        updatedAt: serverTimestamp()
      });
      setActiveDropdown(null);
    } catch {
      alert('There was an error deleting the message. Please try again.');
    }
  };

  const deleteConversation = async () => {
    if (!selectedPatient) return;

    try {
      const messagesRef = collection(db, 'supportMessages');
      const q = query(
        messagesRef, 
        where('participants', 'array-contains', selectedPatient)
      );
      
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      // Delete all messages completely instead of soft-delete
      querySnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });
      
      await batch.commit();
      setConversationDropdown(false);
      setShowDeleteModal(false);
      setView('list');
      setSelectedPatient(null);
      setSelectedPatientData(null);
    } catch {
      alert('There was an error deleting the conversation. Please try again.');
    }
  };

  const startEditing = (msg: ChatMessage) => {
    // Check if user owns the message before editing
    if (!canEditMessage(msg)) {
      alert('You can only edit your own messages.');
      return;
    }

    setEditingMessage(msg);
    setMessage(msg.message);
    setActiveDropdown(null);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setMessage('');
  };

  const toggleDropdown = (messageId: string, message: ChatMessage) => {
    // Only show dropdown for messages the user owns
    if (!canEditMessage(message)) {
      return;
    }
    setActiveDropdown(activeDropdown === messageId ? null : messageId);
  };

  // Updated formatDateTime function to show both day and time
  const formatDateTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) + ' at ' + date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return '';
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleSelectPatient = (patientId: string) => {
    setSelectedPatient(patientId);
    setView('chat');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedPatient(null);
    setSelectedPatientData(null);
    setMessage('');
    setEditingMessage(null);
  };

  const filteredProfiles = patientProfiles.filter(profile =>
    profile.patientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPatientProfile = patientProfiles.find(profile => profile.patientId === selectedPatient);

  // Get patient display name using proper Firestore fields
  const getPatientDisplayName = () => {
    if (selectedPatientData?.displayName) {
      return selectedPatientData.displayName;
    }
    
    if (selectedPatientProfile?.patientName) {
      return selectedPatientProfile.patientName;
    }
    
    return 'Patient';
  };

  // Get patient photo URL using proper Firestore fields
  const getPatientPhotoURL = () => {
    return selectedPatientData?.photoURL || selectedPatientProfile?.photoURL || '';
  };

  // Function to handle image loading errors
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    // The parent will show the fallback User icon
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Notification */}
        {showSuccess && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
            <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg px-6 py-4 flex items-center space-x-3 min-w-80 max-w-md">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-green-800 text-sm font-medium">
                  {editingMessage ? 'Message updated successfully!' : 'Message sent successfully!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Updated Delete Confirmation Modal - Blue Background Matching Conversation Header */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
            <div className="bg-blue-600 rounded-2xl shadow-xl max-w-md w-full mx-4 border border-blue-500">
              {/* Modal Header */}
              <div className="p-6 border-b border-blue-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Delete Conversation</h3>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="text-white hover:text-blue-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="p-6 bg-white rounded-b-2xl">
                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete this entire conversation? This action cannot be undone.
                </p>
                <div className="flex space-x-3 justify-end">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteConversation}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Delete Conversation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Support Messages</h1>
          <p className="text-gray-600">Manage patient conversations</p>
        </div>

        <div className="bg-blue-600 rounded-2xl shadow-lg border border-blue-500 overflow-hidden max-w-6xl mx-auto">
          {view === 'list' ? (
           // Chat List View with Semi-Transparent Background - Individual Cards Remain White
        <div className="p-6 bg-white/80 backdrop-blur-sm rounded-lg">
          {/* Updated: Perfect horizontal alignment with adjusted vertical positioning */}
          <div className="flex items-baseline justify-between mb-6">
            {/* Messages heading with icon - adjusted for baseline alignment */}
            <div className="flex items-baseline">
              <MessageCircle className="w-6 h-6 text-gray-800 mr-2" />
              <h2 className="text-xl font-semibold text-gray-800">Messages</h2>
            </div>
          {/* Search bar - perfectly aligned with Messages heading baseline */}
          <div className="relative w-full max-w-md">
            <Search className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2 z-10" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm"
            />
          </div>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            {filteredProfiles.length === 0 ? (
              <div className="text-center py-16 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200/50">
                <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  {searchTerm ? 'No patients found' : 'No conversations yet'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm ? 'Try adjusting your search terms' : 'Patient conversations will appear here'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProfiles.map((profile) => (
                  <button
                    key={profile.patientId}
                    onClick={() => handleSelectPatient(profile.patientId)}
                    className="w-full p-4 border border-gray-200/70 rounded-lg text-left bg-white/90 backdrop-blur-sm hover:bg-white transition-all hover:border-gray-300 hover:shadow-sm"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        {profile.photoURL ? (
                          <>
                            <img
                              src={profile.photoURL}
                              alt={profile.patientName}
                              className="w-12 h-12 rounded-full flex-shrink-0 object-cover border border-gray-200"
                              onError={handleImageError}
                            />
                            {/* Fallback icon that shows if image fails to load */}
                            <div className="absolute inset-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 hidden">
                              <User className="w-6 h-6 text-blue-600" />
                            </div>
                          </>
                        ) : (
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 border border-blue-200">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 truncate text-lg">{profile.patientName}</h3>
                        <p className="text-gray-700 truncate mt-1">{profile.lastMessage}</p>
                        <p className="text-sm text-gray-500 mt-2">
                          {formatDate(profile.lastMessageTime)}
                        </p>
                      </div>
                      {profile.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 shadow-sm">
                          {profile.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
          ) : (
            // Chat Conversation View with Blue Header
            <div className="flex flex-col h-[600px]">
              {/* Updated Chat Header with Blue Background */}
              <div className="p-4 border-b border-blue-200 bg-blue-600 text-white flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleBackToList}
                    className="flex items-center space-x-2 text-white hover:text-blue-100 transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    {getPatientPhotoURL() ? (
                      <>
                        <img
                          src={getPatientPhotoURL()}
                          alt={getPatientDisplayName()}
                          className="w-10 h-10 rounded-full object-cover border-2 border-white"
                          onError={handleImageError}
                        />
                        {/* Fallback icon that shows if image fails to load */}
                        <div className="absolute inset-0 w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center hidden border-2 border-white">
                          <User className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center border-2 border-white">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{getPatientDisplayName()}</h3>
                    {/* Online status indicator removed */}
                  </div>
                </div>
                
                {/* Conversation Options Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setConversationDropdown(!conversationDropdown)}
                    className="p-2 text-white hover:text-blue-100 hover:bg-blue-700 rounded-lg transition"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  {conversationDropdown && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-blue-200 py-1 z-10 min-w-48">
                      <button
                        onClick={() => {
                          setShowDeleteModal(true);
                          setConversationDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-sm text-red-600 hover:bg-blue-50 flex items-center space-x-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Conversation</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Area - Fixed height with scroll */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center py-16">
                    <div>
                      <p className="text-gray-500">No messages yet</p>
                      <p className="text-sm text-gray-400 mt-2">Start a conversation with the patient</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {chatMessages.map((msg) => (
                      <div key={msg.id}>
                        {/* Updated Date and Time Display - Centered with Full Format */}
                        {msg.createdAt && (
                          <div className="text-center mb-2">
                            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded-full">
                              {formatDateTime(msg.createdAt)}
                            </span>
                          </div>
                        )}
                        
                        {/* Message Bubble or Deleted Message */}
                        {msg.isDeleted ? (
                          <div className={`flex ${msg.senderType === 'staff' ? 'justify-end' : 'justify-start'}`}>
                            <div className="bg-gray-100 rounded-full px-4 py-2">
                              <span className="text-xs text-gray-500 italic">
                                {msg.senderType === 'staff' ? 'Staff' : 'Patient'} deleted a message
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className={`flex ${msg.senderType === 'staff' ? 'justify-end' : 'justify-start'}`}>
                            <div className="relative group">
                              <div
                                className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-3 relative ${
                                  msg.senderType === 'staff'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                
                                {/* Two-dots button - Only show for messages the user owns */}
                                {canEditMessage(msg) && (
                                  <div className="flex justify-end mt-2">
                                    <button
                                      onClick={() => toggleDropdown(msg.id, msg)}
                                      className={`p-1 rounded-full focus:outline-none ${
                                        msg.senderType === 'staff' 
                                          ? 'text-white opacity-70' 
                                          : 'text-gray-600 opacity-70'
                                      }`}
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              
                              {/* Dropdown menu - Only show for messages the user owns */}
                              {activeDropdown === msg.id && canEditMessage(msg) && (
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-blue-200 py-1 z-10 min-w-32">
                                  <button
                                    onClick={() => startEditing(msg)}
                                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center space-x-2"
                                  >
                                    <Edit className="w-4 h-4" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => deleteMessage(msg.id, msg)}
                                    className="w-full px-4 py-2 text-sm text-red-600 hover:bg-blue-50 flex items-center space-x-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Input Area - Always visible when patient is selected */}
              <div className="border-t border-gray-200 p-4 bg-white">
                <form onSubmit={handleSubmit} className="flex items-end space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={1}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <button
                      type="submit"
                      disabled={loading || !message.trim()}
                      className="text-blue-600 hover:text-blue-700 disabled:text-blue-400 p-3 transition flex items-center justify-center"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-6 h-6" />
                      )}
                    </button>
                    {editingMessage && (
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="text-gray-500 hover:text-gray-700 py-2 px-3 transition text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportMessages;