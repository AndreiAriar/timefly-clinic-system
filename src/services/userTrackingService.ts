// src/services/userTrackingService.ts
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, FieldValue } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface UserBookingStats {
  activeAppointments: number;
  totalBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  completedAppointments: number;
  lastBookingDate: string;
  isRestricted: boolean;
  restrictionReason?: string;
  restrictionUntil?: string;
}

/**
 * Get user's current booking statistics
 */
export const getUserBookingStats = async (userEmail: string): Promise<UserBookingStats> => {
  try {
    const userRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Initialize new user stats
      const defaultStats: UserBookingStats = {
        activeAppointments: 0,
        totalBookings: 0,
        cancelledBookings: 0,
        noShowCount: 0,
        completedAppointments: 0,
        lastBookingDate: '',
        isRestricted: false
      };
      
      await setDoc(userRef, defaultStats);
      return defaultStats;
    }
    
    return userDoc.data() as UserBookingStats;
  } catch (error) {
    console.error('Error getting user booking stats:', error);
    throw error;
  }
};

/**
 * Get user's active appointments count
 */
export const getActiveAppointmentsCount = async (userEmail: string): Promise<number> => {
  try {
    const appointmentsRef = collection(db, 'appointments');
    const q = query(
      appointmentsRef,
      where('email', '==', userEmail),
      where('status', 'in', ['pending', 'confirmed'])
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting active appointments count:', error);
    return 0;
  }
};

/**
 * Check if user can book based on their stats
 */
export const canUserBook = async (userEmail: string, priorityLevel: string, appointmentDate: string): Promise<{
  canBook: boolean;
  reason?: string;
}> => {
  try {
    const stats = await getUserBookingStats(userEmail);
    const activeCount = await getActiveAppointmentsCount(userEmail);
    
    // Check if user is restricted
    if (stats.isRestricted) {
      const restrictionDate = stats.restrictionUntil ? new Date(stats.restrictionUntil) : null;
      if (restrictionDate && restrictionDate > new Date()) {
        return {
          canBook: false,
          reason: `Your account is restricted until ${restrictionDate.toLocaleDateString()} due to ${stats.restrictionReason || 'policy violations'}.`
        };
      }
    }
    
    // Check active appointments limit (max 3)
    if (activeCount >= 3) {
      return {
        canBook: false,
        reason: 'You have reached the maximum of 3 active appointments. Please complete or cancel an existing appointment before booking a new one.'
      };
    }
    
    // Check no-show count (max 2 no-shows)
    if (stats.noShowCount >= 3) {
      return {
        canBook: false,
        reason: 'Your booking privileges have been temporarily suspended due to multiple no-shows. Please contact support.'
      };
    }
    
    // Check booking window restrictions
    const now = new Date();
    const appointmentDateTime = new Date(appointmentDate);
    const daysDiff = Math.ceil((appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (priorityLevel === 'emergency' && daysDiff > 1) {
      return {
        canBook: false,
        reason: 'Emergency appointments can only be booked for today or tomorrow.'
      };
    }
    
    if (priorityLevel === 'urgent' && daysDiff > 5) {
      return {
        canBook: false,
        reason: 'Urgent appointments can only be booked up to 5 days in advance.'
      };
    }
    
    if (priorityLevel === 'normal' && daysDiff > 21) {
      return {
        canBook: false,
        reason: 'Normal appointments can only be booked up to 3 weeks in advance.'
      };
    }
    
    // Check cooldown period (prevent spam booking)
    if (stats.lastBookingDate) {
      const lastBooking = new Date(stats.lastBookingDate);
      const hoursSinceLastBooking = (now.getTime() - lastBooking.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastBooking < 1) {
        return {
          canBook: false,
          reason: 'Please wait at least 1 hour between bookings to prevent duplicate appointments.'
        };
      }
    }
    
    return { canBook: true };
  } catch (error) {
    console.error('Error checking if user can book:', error);
    return {
      canBook: false,
      reason: 'Unable to verify booking eligibility. Please try again.'
    };
  }
};

/**
 * Update user stats after booking
 */
export const updateUserStatsAfterBooking = async (userEmail: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        activeAppointments: 1,
        totalBookings: 1,
        cancelledBookings: 0,
        noShowCount: 0,
        completedAppointments: 0,
        lastBookingDate: new Date().toISOString(),
        isRestricted: false
      });
    } else {
      await updateDoc(userRef, {
        activeAppointments: increment(1),
        totalBookings: increment(1),
        lastBookingDate: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error updating user stats after booking:', error);
    throw error;
  }
};

/**
 * Update user stats after appointment completion
 */
export const updateUserStatsAfterCompletion = async (userEmail: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userEmail);
    await updateDoc(userRef, {
      activeAppointments: increment(-1),
      completedAppointments: increment(1)
    });
  } catch (error) {
    console.error('Error updating user stats after completion:', error);
  }
};

/**
 * Update user stats after cancellation
 */
export const updateUserStatsAfterCancellation = async (userEmail: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userEmail);
    await updateDoc(userRef, {
      activeAppointments: increment(-1),
      cancelledBookings: increment(1)
    });
    
    // Check if user has excessive cancellations
    const stats = await getUserBookingStats(userEmail);
    const cancellationRate = stats.cancelledBookings / stats.totalBookings;
    
    if (cancellationRate > 0.5 && stats.totalBookings >= 5) {
      // Warn user about excessive cancellations
      console.warn(`User ${userEmail} has high cancellation rate: ${cancellationRate}`);
    }
  } catch (error) {
    console.error('Error updating user stats after cancellation:', error);
  }
};

/**
 * Record a no-show and apply restrictions if needed
 */
export const recordNoShow = async (userEmail: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userEmail);
    const stats = await getUserBookingStats(userEmail);
    const newNoShowCount = stats.noShowCount + 1;
    
    const updateData: { [key: string]: FieldValue | boolean | string } = {
      activeAppointments: increment(-1),
      noShowCount: increment(1)
    };
    
    // Apply restrictions after 3 no-shows
    if (newNoShowCount >= 3) {
      const restrictionUntil = new Date();
      restrictionUntil.setDate(restrictionUntil.getDate() + 30); // 30-day restriction
      
      updateData.isRestricted = true;
      updateData.restrictionReason = 'Multiple no-shows (3 or more)';
      updateData.restrictionUntil = restrictionUntil.toISOString();
    }
    
    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('Error recording no-show:', error);
  }
};