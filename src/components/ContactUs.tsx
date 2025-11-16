import { useState, useEffect } from 'react';
import { Send, MoreVertical, Edit, Trash2, Headphones, CheckCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, Timestamp, updateDoc, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
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
  isDeleted?: boolean;
}

interface UserData {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'patient' | 'staff';
  displayName?: string;
}

const SupportChat = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [conversationDropdown, setConversationDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

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
        const data = userDoc.data();
        setUserData({
          uid: userDoc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          userType: data.userType || 'patient',
          displayName: data.displayName || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Load chat messages
  useEffect(() => {
    if (!currentUser) return;

    const messagesRef = collection(db, 'supportMessages');
    const q = query(
      messagesRef, 
      where('participants', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData: ChatMessage[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderType: data.senderType,
          message: data.message,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          isDeleted: data.isDeleted || false
        };
      });
      setChatMessages(messagesData);
    }, (error) => {
      console.error('Error loading messages:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Check if current user can edit/delete a message
  const canEditMessage = (message: ChatMessage): boolean => {
    if (!currentUser) return false;
    return message.senderId === currentUser.uid;
  };

  const sendMessage = async () => {
    if (!message.trim() || !currentUser) return;

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
        // Send new message with patient's actual name - using displayName first
        let patientName = 'Patient';
        
        if (userData) {
          // Use displayName first, then fall back to firstName + lastName
          patientName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
          
          // Final fallback if name is still empty
          if (!patientName || patientName === ' ') {
            patientName = userData.email || 'Patient';
          }
        }
        
        await addDoc(collection(db, 'supportMessages'), {
          senderId: currentUser.uid,
          senderName: patientName,
          senderType: 'patient',
          message: message,
          participants: [currentUser.uid, 'staff'],
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
    } catch (error) {
      console.error('Error sending message:', error);
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
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('There was an error deleting the message. Please try again.');
    }
  };

  const deleteConversation = async () => {
    if (!currentUser) return;

    setDeletingConversation(true);
    try {
      const messagesRef = collection(db, 'supportMessages');
      const q = query(
        messagesRef, 
        where('participants', 'array-contains', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref); // Complete wipeout - delete documents entirely
      });
      
      await batch.commit();
      setConversationDropdown(false);
      setShowDeleteConfirm(false);
      setShowDeleteSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowDeleteSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('There was an error deleting the conversation. Please try again.');
    } finally {
      setDeletingConversation(false);
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
    } catch (error) {
      console.error('Error formatting date and time:', error);
      return '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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

        {/* Delete Success Notification */}
        {showDeleteSuccess && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
            <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg px-6 py-4 flex items-center space-x-3 min-w-80 max-w-md">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-green-800 text-sm font-medium">
                  Conversation deleted successfully!
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 backdrop-blur-sm bg-white/5"
              onClick={() => setShowDeleteConfirm(false)}
            ></div>
            
            <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full mx-auto z-[1001] transform transition-all">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Delete Conversation?
                </h3>
                
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete this conversation? This action cannot be undone.
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                    disabled={deletingConversation}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteConversation}
                    disabled={deletingConversation}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500 transition disabled:bg-red-400 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {deletingConversation ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Chat Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Headphones className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Support Chat</h1>
          <p className="text-gray-600">Chat with our support team</p>
        </div>

        {/* Chat Container */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
          {/* Chat Header with Conversation Options */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Headphones className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Support Team</h3>
                {/* Online status indicator removed */}
              </div>
            </div>
            
            {/* Conversation Options Dropdown */}
            <div className="relative">
              <button
                onClick={() => setConversationDropdown(!conversationDropdown)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              
              {conversationDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-48">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setConversationDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Conversation</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Messages Area - No internal scrollbar */}
          <div className="p-4 bg-gray-50 min-h-[400px]">
            {chatMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center py-16">
                <div>
                  <p className="text-gray-500">No messages yet</p>
                  <p className="text-sm text-gray-400 mt-2">Start a conversation with our support team</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {chatMessages.map((msg) => (
                  <div key={msg.id}>
                    {/* Date and Time - Only show when timestamp is valid */}
                    {msg.createdAt && (
                      <div className="text-center mb-2">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {formatDateTime(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    
                    {/* Message Bubble or Deleted Message */}
                    {msg.isDeleted ? (
                      <div className={`flex ${msg.senderType === 'patient' ? 'justify-end' : 'justify-start'}`}>
                        <div className="bg-gray-100 rounded-full px-4 py-2">
                          <span className="text-xs text-gray-500 italic">
                            {msg.senderType === 'patient' ? 'You' : 'Staff'} deleted a message
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex ${msg.senderType === 'patient' ? 'justify-end' : 'justify-start'}`}>
                        <div className="relative group">
                          <div
                            className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-3 relative ${
                              msg.senderType === 'patient'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-gray-200 text-gray-800 rounded-bl-none'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            
                            {/* Two-dots button - Only show for messages the user owns */}
                            {msg.senderType === 'patient' && canEditMessage(msg) && (
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => toggleDropdown(msg.id, msg)}
                                  className="text-white opacity-70 p-1 rounded-full focus:outline-none"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Dropdown menu - Only show for messages the user owns */}
                          {msg.senderType === 'patient' && activeDropdown === msg.id && canEditMessage(msg) && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-32">
                              <button
                                onClick={() => startEditing(msg)}
                                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => deleteMessage(msg.id, msg)}
                                className="w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center space-x-2"
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

          {/* Input Area - Fixed with form wrapper */}
          <div className="border-t border-gray-200 p-4">
            <form onSubmit={handleSubmit} className="flex items-end space-x-3">
              <div className="flex-1">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  rows={1}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
                  disabled={loading}
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
      </div>
    </div>
  );
};

export default SupportChat;