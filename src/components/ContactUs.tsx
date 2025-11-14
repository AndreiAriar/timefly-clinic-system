import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Clock, Send, MessageCircle, User as UserIcon, Edit, Trash2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, Timestamp, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  urgency: 'normal' | 'urgent' | 'emergency';
  status: 'new' | 'read' | 'replied';
  createdAt: Timestamp;
}

interface ReplyMessage {
  id: string;
  contactMessageId: string;
  staffName: string;
  message: string;
  createdAt: Timestamp;
}

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    urgency: 'normal'
  });
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [myMessages, setMyMessages] = useState<ContactMessage[]>([]);
  const [allReplies, setAllReplies] = useState<ReplyMessage[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [editingMessage, setEditingMessage] = useState<ContactMessage | null>(null);
  const [editFormData, setEditFormData] = useState({
    subject: '',
    message: '',
    urgency: 'normal' as 'normal' | 'urgent' | 'emergency'
  });
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  // Check authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
        setCurrentUser(user);
        setUserEmail(user.email || '');
        // Pre-fill form with user data if available
        setFormData(prev => ({
          ...prev,
          name: user.displayName || prev.name,
          email: user.email || prev.email
        }));
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value.replace(/\D/g, '').slice(0, 11);
  setFormData(prev => ({ ...prev, phone: value }));
};

const validatePhoneNumber = (phone: string): boolean => {
  if (phone.length === 0) return true; // Allow empty (optional field)
  if (phone.length !== 11) return false;
  return phone.startsWith('09');
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use logged-in user's email if available
      const submitEmail = isLoggedIn && currentUser ? currentUser.email : formData.email;
      
      if (!submitEmail) {
        alert('Please provide an email address');
        setLoading(false);
        return;
      }

      // Save to Firebase
      await addDoc(collection(db, 'contactMessages'), {
        name: formData.name || currentUser?.displayName || 'User',
        email: submitEmail,
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message,
        urgency: formData.urgency,
        status: 'new',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Set user email to show their messages
      setUserEmail(submitEmail);
      setShowSuccess(true);
      
      // Reset form but keep user info
      setFormData(prev => ({
        name: isLoggedIn && currentUser ? currentUser.displayName || '' : '',
        email: isLoggedIn && currentUser ? currentUser.email || '' : prev.email,
        phone: '',
        subject: '',
        message: '',
        urgency: 'normal'
      }));

      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Error submitting contact form:', error);
      alert('There was an error sending your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load user's messages when userEmail changes or on component mount for logged-in users
  useEffect(() => {
    if (userEmail || (isLoggedIn && currentUser?.email)) {
      const emailToUse = userEmail || (currentUser?.email || '');
      const messagesRef = collection(db, 'contactMessages');
      const q = query(messagesRef, where('email', '==', emailToUse), orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messagesData: ContactMessage[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            subject: data.subject || '',
            message: data.message || '',
            urgency: data.urgency || 'normal',
            status: data.status || 'new',
            createdAt: data.createdAt || Timestamp.now()
          };
        });
        setMyMessages(messagesData);
      });

      return () => unsubscribe();
    } else {
      setMyMessages([]);
    }
  }, [userEmail, isLoggedIn, currentUser]);

  // Auto-load messages for logged-in users on component mount
  useEffect(() => {
    if (isLoggedIn && currentUser?.email && !userEmail) {
      setUserEmail(currentUser.email);
    }
  }, [isLoggedIn, currentUser, userEmail]);

  // Load all replies
  useEffect(() => {
    const repliesRef = collection(db, 'contactReplies');
    const q = query(repliesRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const repliesData: ReplyMessage[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          contactMessageId: data.contactMessageId,
          staffName: data.staffName,
          message: data.message,
          createdAt: data.createdAt
        };
      });
      setAllReplies(repliesData);
    });

    return () => unsubscribe();
  }, []);

  // Edit message function
  const handleEditMessage = async () => {
    if (!editingMessage) return;

    try {
      const messageRef = doc(db, 'contactMessages', editingMessage.id);
      await updateDoc(messageRef, {
        subject: editFormData.subject,
        message: editFormData.message,
        urgency: editFormData.urgency,
        updatedAt: serverTimestamp()
      });

      setMyMessages(prev => prev.map(msg => 
        msg.id === editingMessage.id ? { 
          ...msg, 
          subject: editFormData.subject,
          message: editFormData.message,
          urgency: editFormData.urgency
        } : msg
      ));

      setEditingMessage(null);
      setEditFormData({ subject: '', message: '', urgency: 'normal' });
      setSuccessMessage('Message updated successfully!');
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 5000);
    } catch (err) {
      console.error('Error editing message:', err);
      alert('Failed to edit message. Please try again.');
    }
  };

  // Unsend/Delete message function
const handleUnsendMessage = async (messageId: string) => {
  setMessageToDelete(messageId);
  setShowDeleteModal(true);
};

const confirmDelete = async () => {
  if (!messageToDelete) return;

  try {
    // Delete the message from Firebase
    await deleteDoc(doc(db, 'contactMessages', messageToDelete));
    
    // Also delete any associated replies
    const repliesToDelete = allReplies.filter(reply => reply.contactMessageId === messageToDelete);
    for (const reply of repliesToDelete) {
      await deleteDoc(doc(db, 'contactReplies', reply.id));
    }

    setMyMessages(prev => prev.filter(msg => msg.id !== messageToDelete));
    setSuccessMessage('Message deleted successfully!');
    setShowSuccessNotification(true);
    setTimeout(() => setShowSuccessNotification(false), 5000);
  } catch (err) {
    console.error('Error deleting message:', err);
    alert('Failed to delete message. Please try again.');
  } finally {
    setShowDeleteModal(false);
    setMessageToDelete(null);
  }
};

const cancelDelete = () => {
  setShowDeleteModal(false);
  setMessageToDelete(null);
};

  // Start editing a message
  const startEditing = (message: ContactMessage) => {
    setEditingMessage(message);
    setEditFormData({
      subject: message.subject,
      message: message.message,
      urgency: message.urgency
    });
  };

  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      const date = timestamp.toDate();
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch {
      return 'Invalid date';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'urgent': return 'bg-orange-100 text-orange-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getRepliesForMessage = (messageId: string) => {
    return allReplies.filter(reply => reply.contactMessageId === messageId);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Success Notification Bar */}
        {showSuccessNotification && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-6 py-4 flex items-center space-x-3 min-w-80 max-w-md">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-gray-800 text-sm font-medium">{successMessage}</p>
              </div>
            </div>
          </div>
        )}


        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We're here to help you. Get in touch with us for any questions or concerns.
          </p>
        </div>
        

        {/* Success Notification */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 max-w-4xl mx-auto">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Message sent successfully! We'll get back to you soon.
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Your messages and replies will appear below automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Single Modal Box - Contact Form and Information Combined */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left Side - Contact Form */}
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                   <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="your.email@example.com"
                  />
                  </div>
                </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">+63</span>
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      onBlur={(e) => {
                        const phone = e.target.value;
                        if (phone && !validatePhoneNumber(phone)) {
                          alert('Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g., 09123456789)');
                          setFormData(prev => ({ ...prev, phone: '' }));
                        }
                      }}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="912 345 6789"
                      maxLength={11}
                      pattern="[0-9]{11}"
                      title="Please enter a valid 11-digit Philippine mobile number (e.g., 09123456789)"
                    />
                  </div>
                  {formData.phone && !validatePhoneNumber(formData.phone) && (
                    <p className="text-xs text-red-500 mt-1">
                      ❌ Must be 11 digits starting with 09
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your 11-digit PH mobile number (e.g., 09123456789)
                  </p>
                </div>

                <div>
                  <label htmlFor="urgency" className="block text-sm font-medium text-gray-700 mb-1">
                    Urgency Level
                  </label>
                  <select
                    id="urgency"
                    name="urgency"
                    value={formData.urgency}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject *
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="appointment">Appointment Question</option>
                    <option value="technical">Technical Support</option>
                    <option value="billing">Billing Issue</option>
                    <option value="emergency">Emergency</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-vertical"
                    placeholder="Please describe your inquiry or concern in detail..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-6 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Side - Contact Information */}
            <div className="bg-blue-600 text-white p-8">
              {/* Image */}
              <div className="flex justify-center -mt-16 -mb-8">
                <img 
                  src="/contactus.png" 
                  alt="Contact Us Illustration"
                  className="w-80 h-80 mx-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>

              <h2 className="text-2xl font-bold mb-2">Get In Touch</h2>
              <p className="mb-6 opacity-90">
                We are here to assist you with any questions about our services, appointments, or technical support.
              </p>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <Phone className="w-6 h-6 text-white mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Phone</h3>
                    <p className="opacity-90">0909 400 6245</p>
                    <p className="text-sm opacity-80">Emergency after-hours: Same number</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <Mail className="w-6 h-6 text-white mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Email</h3>
                    <p className="opacity-90">timefly.healthcare@gmail.com</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <MapPin className="w-6 h-6 text-white mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Address</h3>
                    <p className="opacity-90">
                      Ground Floor Saint Paul Surigao University Hospital,<br />
                      Km. 4 National Highway,<br />
                      Surigao City, Philippines
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <Clock className="w-6 h-6 text-white mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Business Hours</h3>
                    <p className="opacity-90">Monday - Friday: 8:00 AM - 5:00 PM</p>
                    <p className="opacity-90">Saturday: 8:00 AM - 12:00 PM</p>
                    <p className="text-sm opacity-80">Sunday: Closed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages & Replies Section - Shows automatically for logged-in users or after form submission */}
        {(userEmail || (isLoggedIn && myMessages.length > 0)) && (
          <div className="mt-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-4xl mx-auto">
              <div className="flex items-center space-x-2 mb-6">
                <MessageCircle className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">Your Messages & Replies</h2>
                <span className="text-sm text-gray-500">
                  {isLoggedIn ? `(for ${currentUser?.email})` : `(for ${userEmail})`}
                </span>
                {isLoggedIn && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    Auto-loaded
                  </span>
                )}
              </div>
              
              {myMessages.length > 0 ? (
                <div className="space-y-6">
                  {myMessages.map((message) => {
                    const messageReplies = getRepliesForMessage(message.id);
                    return (
                      <div key={message.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Message Header */}
                        <div className="bg-gray-50 p-4 border-b border-gray-200">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{message.subject}</h3>
                              <p className="text-sm text-gray-600 mt-1">
                                Sent on {formatDate(message.createdAt)} • 
                                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getUrgencyColor(message.urgency)}`}>
                                  {message.urgency}
                                </span>
                              </p>
                            </div>
                            <div className="mt-2 sm:mt-0">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                messageReplies.length > 0 ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
                              }`}>
                                {messageReplies.length > 0 ? `${messageReplies.length} Repl${messageReplies.length === 1 ? 'y' : 'ies'}` : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>

                     {/* Message Content */}
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">Your Message</span>
                            <span className="text-sm text-gray-500">{formatDate(message.createdAt)}</span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap mb-3">{message.message}</p>
                          
                         {/* Edit and Delete Buttons - Positioned below the message, aligned to the right */}
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => startEditing(message)}
                            className="text-gray-500 hover:text-yellow-600 transition p-1"
                            title="Edit Message"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUnsendMessage(message.id)}
                            className="text-gray-500 hover:text-red-600 transition p-1"
                            title="Delete Message"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        </div>
                        </div>
                        </div>

                        {/* Delete Confirmation Modal */}
                        {showDeleteModal && (
                          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
                            <div 
                              className="fixed inset-0 backdrop-blur-sm transition-opacity"
                              onClick={cancelDelete}
                              aria-hidden="true"
                            ></div>
                            
                            <div 
                              className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-6">
                                <div className="text-center">
                                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                                    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                  </div>
                                  <p className="text-gray-600 mb-6">
                                    Are you sure you want to delete this message? This action cannot be undone.
                                  </p>
                                  <div className="flex gap-3 justify-center">
                                    <button
                                      onClick={cancelDelete}
                                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={confirmDelete}
                                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Edit Message Section */}
                        {editingMessage?.id === message.id ? (
                          <div className="p-4 border-b border-gray-200">
                            <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center">
                              <Edit className="w-4 h-4 text-gray-600 mr-2" />
                              Edit Message
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
                                <input
                                  type="text"
                                  value={editFormData.subject}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, subject: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Message</label>
                                <textarea
                                  value={editFormData.message}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, message: e.target.value }))}
                                  rows={4}
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-vertical"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Urgency</label>
                                <select
                                  value={editFormData.urgency}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, urgency: e.target.value as 'normal' | 'urgent' | 'emergency' }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                >
                                  <option value="normal">Normal</option>
                                  <option value="urgent">Urgent</option>
                                  <option value="emergency">Emergency</option>
                                </select>
                              </div>
                              <div className="flex space-x-2 justify-end">
                                <button
                                  onClick={() => setEditingMessage(null)}
                                  className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition text-sm"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleEditMessage}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition text-sm"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Staff Replies */}
                        {messageReplies.length > 0 ? (
                          <div className="p-4 bg-green-50">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                              <MessageCircle className="w-4 h-4 text-green-600 mr-2" />
                              Staff Responses ({messageReplies.length})
                            </h4>
                            <div className="space-y-3">
                              {messageReplies.map((reply) => (
                                <div key={reply.id} className="bg-white rounded-lg p-3 border border-green-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                        <MessageCircle className="w-3 h-3 text-white" />
                                      </div>
                                      <div>
                                        <span className="font-medium text-green-900 text-sm">{reply.staffName}</span>
                                        <p className="text-xs text-green-600">TimeFly Staff</p>
                                      </div>
                                    </div>
                                    <span className="text-xs text-green-600">{formatDate(reply.createdAt)}</span>
                                  </div>
                                  <p className="text-green-800 text-sm whitespace-pre-wrap">{reply.message}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-yellow-50 text-center">
                            <p className="text-yellow-800 text-sm">No responses yet. Our staff will reply soon.</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No messages found</p>
                  <p className="text-sm text-gray-400 mt-2">Send a message above to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactUs;