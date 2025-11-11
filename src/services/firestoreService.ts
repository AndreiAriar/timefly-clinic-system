import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

interface AppointmentData {
  userEmail: string;
  doctorName: string;
  date: string;
  time: string;
  reason: string;
  status?: string;
}

interface FeedbackData {
  userEmail: string;
  rating: number;
  comment: string;
  userName?: string;
}

interface FirestoreError {
  message: string;
}

export const createAppointment = async (appointmentData: AppointmentData) => {
  try {
    const docRef = await addDoc(collection(db, 'appointments'), {
      ...appointmentData,
      status: appointmentData.status || 'pending',
      createdAt: Timestamp.now()
    });
    return { id: docRef.id, error: null };
  } catch (error) {
    const errorMessage = (error as FirestoreError).message || 'An error occurred';
    return { id: null, error: errorMessage };
  }
};

export const getAppointments = async (userEmail: string) => {
  try {
    const q = query(
      collection(db, 'appointments'),
      where('userEmail', '==', userEmail),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const appointments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { appointments, error: null };
  } catch (error) {
    const errorMessage = (error as FirestoreError).message || 'An error occurred';
    return { appointments: [], error: errorMessage };
  }
};

export const getAllAppointments = async () => {
  try {
    const q = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const appointments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { appointments, error: null };
  } catch (error) {
    const errorMessage = (error as FirestoreError).message || 'An error occurred';
    return { appointments: [], error: errorMessage };
  }
};

export const updateAppointment = async (appointmentId: string, updates: Partial<AppointmentData>) => {
  try {
    const docRef = doc(db, 'appointments', appointmentId);
    await updateDoc(docRef, updates);
    return { error: null };
  } catch (error) {
    const errorMessage = (error as FirestoreError).message || 'An error occurred';
    return { error: errorMessage };
  }
};

export const deleteAppointment = async (appointmentId: string) => {
  try {
    await deleteDoc(doc(db, 'appointments', appointmentId));
    return { error: null };
  } catch (error) {
    const errorMessage = (error as FirestoreError).message || 'An error occurred';
    return { error: errorMessage };
  }
};

export const getQueueStatus = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'queue'));
    const queue = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { queue, error: null };
  } catch (error) {
    const errorMessage = (error as FirestoreError).message || 'An error occurred';
    return { queue: [], error: errorMessage };
  }
};

export const createFeedback = async (feedbackData: FeedbackData) => {
  try {
    const docRef = await addDoc(collection(db, 'feedbacks'), {
      ...feedbackData,
      createdAt: Timestamp.now()
    });
    return { id: docRef.id, error: null };
  } catch (error) {
    const errorMessage = (error as FirestoreError).message || 'An error occurred';
    return { id: null, error: errorMessage };
  }
};

export const getFeedbacks = async () => {
  try {
    const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const feedbacks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { feedbacks, error: null };
  } catch (error) {
    const errorMessage = (error as FirestoreError).message || 'An error occurred';
    return { feedbacks: [], error: errorMessage };
  }
};