import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, name } = req.body;

    console.log('📧 Received request to send doctor invitation to:', email);

    // Validate input
    if (!email || !name) {
      return res.status(400).json({ success: false, error: 'Email and name are required' });
    }

    // DEBUG: Log what environment variables exist
    console.log('🔍 Checking environment variables...');
    console.log('FIREBASE_PROJECT_ID exists:', !!process.env.FIREBASE_PROJECT_ID);
    console.log('FIREBASE_CLIENT_EMAIL exists:', !!process.env.FIREBASE_CLIENT_EMAIL);
    console.log('FIREBASE_PRIVATE_KEY exists:', !!process.env.FIREBASE_PRIVATE_KEY);
    console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
    console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);

    // Check environment variables
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.error('❌ Missing Firebase Admin credentials');
      console.error('Missing:', {
        projectId: !process.env.FIREBASE_PROJECT_ID,
        clientEmail: !process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: !process.env.FIREBASE_PRIVATE_KEY
      });
      return res.status(500).json({ 
        success: false,
        error: 'Firebase Admin credentials not configured. Please contact administrator.' 
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('❌ Missing email credentials');
      return res.status(500).json({ 
        success: false,
        error: 'Email service not configured. Please contact administrator.' 
      });
    }

    // Create user in Firebase Authentication
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('👤 User already exists:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user with a temporary password
        const tempPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
        userRecord = await admin.auth().createUser({
          email: email,
          password: tempPassword,
          displayName: `Dr. ${name}`,
          emailVerified: false,
        });
        
        // Set custom claims for doctor role
        await admin.auth().setCustomUserClaims(userRecord.uid, { 
          role: 'doctor',
          name: name 
        });
        
        console.log('✅ New user created:', userRecord.uid);
      } else {
        throw error;
      }
    }

    // Generate password reset link
    const actionCodeSettings = {
      url: process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'),
      handleCodeInApp: false,
    };

    const passwordResetLink = await admin.auth().generatePasswordResetLink(
      email,
      actionCodeSettings
    );

    console.log(`🔗 Generated Firebase password reset link for: ${email}`);

    // Send email with Firebase password reset link
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to TimeFly - Set Up Your Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">TimeFly Healthcare</h1>
            <p style="color: #666; margin: 5px 0 0 0;">Eye Care Management System</p>
          </div>
          
          <h2 style="color: #333;">Welcome to TimeFly, Dr. ${name}!</h2>
          
          <p>Your doctor account has been successfully created in the TimeFly Healthcare system.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">Your Account Details:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Name:</strong> Dr. ${name}</p>
            <p><strong>Role:</strong> Doctor</p>
          </div>
          
          <div style="background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #b3d9ff;">
            <h3 style="color: #0066cc; margin-top: 0;">🔐 Set Up Your Password</h3>
            <p>To complete your account setup and access the system, please click the button below to create your password:</p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${passwordResetLink}" 
                 style="display: inline-block; padding: 15px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Set Up Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${passwordResetLink}
            </p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <p style="color: #856404; margin: 0;">
              <strong>⚠️ Important:</strong> This link will expire in 1 hour. If it expires, please use the "Forgot Password" option on the login page.
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
            <ol style="margin: 0; padding-left: 20px;">
              <li>Click the "Set Up Password" button above</li>
              <li>Create a strong, secure password</li>
              <li>Log in to access your doctor dashboard</li>
              <li>Start managing your appointments</li>
            </ol>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you have any questions or need assistance, please reply to this email or contact the TimeFly administrator.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This is an automated message from TimeFly Healthcare System.</p>
            <p>If you did not request this account, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Doctor invitation email sent successfully:', result.messageId);

    return res.status(200).json({ 
      success: true, 
      message: 'Doctor invitation sent successfully',
      userId: userRecord.uid
    });

  } catch (error) {
    console.error('❌ Error sending doctor invitation:', error);
    
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to send doctor invitation'
    });
  }
}