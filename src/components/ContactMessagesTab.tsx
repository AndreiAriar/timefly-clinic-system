import { useState, useEffect } from 'react';
import { Mail, Clock, User, Send, MessageCircle, Phone, MessageSquare, Edit, Trash2 } from 'lucide-react';
import { collection, query, orderBy, doc, updateDoc, onSnapshot, Timestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

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
  updatedAt: Timestamp;
}

interface ReplyMessage {
  id: string;
  contactMessageId: string;
  staffName: string;
  message: string;
  createdAt: Timestamp;
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error';
}

const ContactMessagesTab = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'urgent' | 'emergency'>('all');
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [allReplies, setAllReplies] = useState<ReplyMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [editingReply, setEditingReply] = useState<ReplyMessage | null>(null);
  const [editReplyText, setEditReplyText] = useState('');

  // Add notification
  const addNotification = (message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  // Remove notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // Real-time listener for new messages
  useEffect(() => {
    const messagesRef = collection(db, 'contactMessages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'));
    
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
          createdAt: data.createdAt || Timestamp.now(),
          updatedAt: data.updatedAt || Timestamp.now()
        };
      });
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, []);

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

  const updateMessageStatus = async (id: string, status: 'read' | 'replied') => {
    try {
      const messageRef = doc(db, 'contactMessages', id);
      await updateDoc(messageRef, {
        status,
        updatedAt: Timestamp.now()
      });

      setMessages(prev => prev.map(msg => 
        msg.id === id ? { ...msg, status } : msg
      ));
      
      if (selectedMessage && selectedMessage.id === id) {
        setSelectedMessage(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      console.error('Error updating message status:', err);
      addNotification('Failed to update message status', 'error');
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedMessage) return;

    try {
      // Save reply to Firebase
      await addDoc(collection(db, 'contactReplies'), {
        contactMessageId: selectedMessage.id,
        staffName: 'Staff Member',
        message: replyText,
        createdAt: Timestamp.now()
      });

      // Update message status to replied
      await updateMessageStatus(selectedMessage.id, 'replied');
      
      // Clear reply text and close reply box
      setReplyText('');
      setIsReplying(false);
      
      addNotification('Reply sent successfully!', 'success');
    } catch (err) {
      console.error('Error sending reply:', err);
      addNotification('Failed to send reply', 'error');
    }
  };

  // Edit reply function
  const handleEditReply = async () => {
    if (!editingReply) return;

    try {
      const replyRef = doc(db, 'contactReplies', editingReply.id);
      await updateDoc(replyRef, {
        message: editReplyText,
      });

      setAllReplies(prev => prev.map(reply => 
        reply.id === editingReply.id ? { 
          ...reply, 
          message: editReplyText
        } : reply
      ));

      setEditingReply(null);
      setEditReplyText('');
      addNotification('Reply updated successfully!', 'success');
    } catch (err) {
      console.error('Error editing reply:', err);
      addNotification('Failed to edit reply', 'error');
    }
  };

  // Delete reply function
  const handleDeleteReply = async (replyId: string) => {
    try {
      await deleteDoc(doc(db, 'contactReplies', replyId));
      
      setAllReplies(prev => prev.filter(reply => reply.id !== replyId));
      addNotification('Reply deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting reply:', err);
      addNotification('Failed to delete reply', 'error');
    }
  };

  // Unsend/Delete message function
  const handleUnsendMessage = async (messageId: string) => {
    try {
      // Delete the message from Firebase
      await deleteDoc(doc(db, 'contactMessages', messageId));
      
      // Also delete any associated replies
      const repliesToDelete = allReplies.filter(reply => reply.contactMessageId === messageId);
      for (const reply of repliesToDelete) {
        await deleteDoc(doc(db, 'contactReplies', reply.id));
      }

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      addNotification('Message deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting message:', err);
      addNotification('Failed to delete message', 'error');
    }
  };

  const markAsRead = (id: string) => {
    updateMessageStatus(id, 'read');
  };

  const markAsReplied = (id: string) => {
    updateMessageStatus(id, 'replied');
  };

  const filteredMessages = messages.filter(message => {
    if (filter === 'all') return true;
    if (filter === 'new') return message.status === 'new';
    if (filter === 'urgent') return message.urgency === 'urgent';
    if (filter === 'emergency') return message.urgency === 'emergency';
    return true;
  });

  const getRepliesForMessage = (messageId: string) => {
    return allReplies.filter(reply => reply.contactMessageId === messageId);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-green-100 text-green-800';
      case 'replied': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  // Start editing a reply
  const startEditingReply = (reply: ReplyMessage) => {
    setEditingReply(reply);
    setEditReplyText(reply.message);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* General Notifications Bar */}
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down"
        >
          <div className={`bg-white border border-gray-200 rounded-lg shadow-lg px-6 py-4 flex items-center space-x-3 min-w-80 max-w-md ${
            notification.type === 'error' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500'
          }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {notification.type === 'success' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                )}
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-gray-800 text-sm font-medium">{notification.message}</p>
            </div>
          </div>
        </div>
      ))}
      
        {/* Header - More Compact */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Contact Messages</h1>
          <p className="text-gray-600 text-sm mt-1">Manage and respond to patient inquiries</p>
        </div>

        {/* Filters - More Compact */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filter === 'all' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({messages.length})
            </button>
            <button
              onClick={() => setFilter('new')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filter === 'new' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              New ({messages.filter(m => m.status === 'new').length})
            </button>
            <button
              onClick={() => setFilter('urgent')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filter === 'urgent' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Urgent ({messages.filter(m => m.urgency === 'urgent').length})
            </button>
            <button
              onClick={() => setFilter('emergency')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filter === 'emergency' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Emergency ({messages.filter(m => m.urgency === 'emergency').length})
            </button>
          </div>
        </div>

        {/* Messages List - More Compact */}
        <div className="space-y-4">
          {filteredMessages.map((message) => {
            const messageReplies = getRepliesForMessage(message.id);
            
            return (
              <div
                key={message.id}
                className={`bg-white rounded-lg shadow-sm border-l-4 ${
                  message.urgency === 'emergency' ? 'border-l-red-500' :
                  message.urgency === 'urgent' ? 'border-l-orange-500' :
                  'border-l-blue-500'
                } transition hover:shadow-md`}
              >
                {/* Message Header - More Compact */}
                <div className="p-3 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-indigo-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{message.name}</h3>
                          <div className="flex items-center space-x-1 ml-2">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(message.urgency)}`}>
                              {message.urgency}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(message.status)}`}>
                              {message.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{message.email}</span>
                          </div>
                          {message.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Phone className="w-3 h-3" />
                              <span>{message.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <h4 className="font-medium text-gray-900 text-sm">{message.subject}</h4>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{message.message}</p>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                    {message.status === 'new' && (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    )}
                  </div>
                </div>

                {/* Staff Replies Section - More Compact */}
                {messageReplies.length > 0 && (
                  <div className="p-3 bg-green-50 border-b border-green-200">
                    <h4 className="font-semibold text-gray-900 text-sm mb-2 flex items-center">
                      <MessageCircle className="w-3 h-3 text-green-600 mr-1.5" />
                      Staff Responses ({messageReplies.length})
                    </h4>
                    <div className="space-y-2">
                      {messageReplies.map((reply) => (
                        <div key={reply.id} className="bg-white rounded p-2 border border-green-200">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-1.5">
                              <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                                <MessageSquare className="w-2.5 h-2.5 text-white" />
                              </div>
                              <div>
                                <span className="font-medium text-green-900 text-xs">{reply.staffName}</span>
                                <p className="text-xs text-green-600">TimeFly Staff</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-green-600">{formatDate(reply.createdAt)}</span>
                              {/* Edit and Delete Reply Buttons */}
                              <div className="flex space-x-1 ml-2">
                                <button
                                  onClick={() => startEditingReply(reply)}
                                  className="text-yellow-600 hover:text-yellow-800 transition text-xs p-1"
                                  title="Edit Reply"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteReply(reply.id)}
                                  className="text-red-600 hover:text-red-800 transition text-xs p-1"
                                  title="Delete Reply"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* Edit Reply Section */}
                          {editingReply?.id === reply.id ? (
                            <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                              <label className="text-xs font-medium text-gray-500 block mb-1">Edit your reply:</label>
                              <textarea
                                value={editReplyText}
                                onChange={(e) => setEditReplyText(e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-vertical"
                              />
                              <div className="flex space-x-2 justify-end mt-2">
                                <button
                                  onClick={() => setEditingReply(null)}
                                  className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-1 px-3 rounded transition text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleEditReply}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded transition text-xs"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-green-800 text-xs whitespace-pre-wrap">{reply.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons Section */}
                <div className="p-3">
                  {selectedMessage?.id === message.id && isReplying ? (
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-gray-500 block">Your Reply</label>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your response to the patient..."
                        rows={2}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-vertical"
                      />
                      <div className="flex space-x-2 justify-center">
                        <button
                          onClick={sendReply}
                          disabled={!replyText.trim()}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-1.5 px-4 rounded-full transition flex items-center justify-center space-x-1 text-xs"
                        >
                          <Send className="w-3 h-3" />
                          <span>Send Reply</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsReplying(false);
                            setReplyText('');
                            setSelectedMessage(null);
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-1.5 px-4 rounded-full transition text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex space-x-2 justify-center">
                      <button
                        onClick={() => {
                          setSelectedMessage(message);
                          markAsReplied(message.id);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-4 rounded-full transition text-xs"
                      >
                        Mark as Replied
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMessage(message);
                          setIsReplying(true);
                          if (message.status === 'new') {
                            markAsRead(message.id);
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-4 rounded-full transition text-xs"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => handleUnsendMessage(message.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-4 rounded-full transition text-xs flex items-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Unsend</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredMessages.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <Mail className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-900 mb-1">No messages found</h3>
              <p className="text-gray-500 text-sm">There are no messages matching your current filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactMessagesTab;