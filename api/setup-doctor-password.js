import { doctorInvitations } from './send-doctor-invitation.js';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// Initialize Firebase Admin (only if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = getAuth();
const db = getFirestore();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Token and password are required' 
    });
  }

  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      error: 'Password must be at least 6 characters long' 
    });
  }

  const invitation = doctorInvitations.get(token);

  if (!invitation) {
    return res.status(404).json({ 
      success: false, 
      error: 'Invalid or expired invitation token' 
    });
  }

  // Check if token has expired
  if (Date.now() > invitation.expiresAt) {
    doctorInvitations.delete(token);
    return res.status(410).json({ 
      success: false, 
      error: 'Invitation link has expired' 
    });
  }

  try {
    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: invitation.email,
      password: password,
      displayName: invitation.name,
      emailVerified: true, // Auto-verify since invitation was sent to their email
    });

    console.log('✅ Firebase Auth user created:', userRecord.uid);

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: invitation.email,
      name: invitation.name,
      role: 'doctor',
      createdAt: new Date().toISOString(),
      setupCompletedAt: new Date().toISOString()
    });

    console.log('✅ User document created in Firestore');

    // Remove the used invitation token
    doctorInvitations.delete(token);

    res.status(200).json({ 
      success: true, 
      message: 'Account setup completed successfully',
      email: invitation.email
    });

  } catch (error) {
    console.error('❌ Error setting up doctor account:', error);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ 
        success: false, 
        error: 'An account with this email already exists' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: `Failed to set up account: ${error.message}` 
    });
  }
}