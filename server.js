import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for verification codes and doctor invitations
const verificationCodes = new Map();
const doctorInvitations = new Map();

// Nodemailer transporter with better error handling
let transporter;
try {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  
  // Verify transporter configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log('❌ Transporter verification failed:', error);
    } else {
      console.log('✅ Transporter is ready to send emails');
    }
  });
  
} catch (error) {
  console.error('❌ Failed to create nodemailer transporter:', error.message);
}

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Email server is running!',
    email_user: process.env.EMAIL_USER,
    email_password_set: !!process.env.EMAIL_PASSWORD
  });
});

// Send doctor invitation
app.post('/send-doctor-invitation', async (req, res) => {
  const { email, name } = req.body;

  console.log('📧 Received request to send doctor invitation to:', email);

  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  // Check if email credentials are set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('❌ Missing email credentials');
    return res.status(500).json({ 
      error: 'Email service not configured' 
    });
  }

  // Check if transporter is created
  if (!transporter) {
    console.log('❌ Transporter not initialized');
    return res.status(500).json({ 
      error: 'Email service not properly configured' 
    });
  }

  try {
    // Generate secure token for password setup
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    // Store invitation data
    doctorInvitations.set(token, {
      email,
      name,
      expiresAt
    });

    console.log(`📧 Attempting to send doctor invitation to: ${email}`);
    console.log(`🔑 Generated token: ${token}`);

    // Create instructions instead of a broken link
    const setupInstructions = `
      Please contact the TimeFly administrator to complete your account setup and password creation.
      Your account has been created with the following details:
      - Email: ${email}
      - Name: Dr. ${name}
      
      The administrator will provide you with further instructions to access the system.
    `;

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to TimeFly - Account Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">TimeFly Healthcare</h1>
            <p style="color: #666; margin: 5px 0 0 0;">Eye Care Management System</p>
          </div>
          
          <h2 style="color: #333;">Welcome to TimeFly, Dr. ${name}!</h2>
          
          <p>Your account has been successfully created in the TimeFly Healthcare system.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">Your Account Details:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Name:</strong> Dr. ${name}</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <h3 style="color: #856404; margin-top: 0;">Next Steps:</h3>
            <p>To complete your account setup and set your password, please:</p>
            <ol>
              <li>Contact the TimeFly system administrator</li>
              <li>Request your account activation and password setup</li>
              <li>You will receive further instructions directly from the administrator</li>
            </ol>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you have any questions or need immediate assistance, please reply to this email.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This is an automated message from TimeFly Healthcare System.</p>
          </div>
        </div>
      `,
    };

    console.log('📤 Sending doctor invitation email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Doctor invitation email sent successfully:', result.messageId);

    res.status(200).json({ 
      success: true, 
      message: 'Doctor invitation sent successfully' 
    });

  } catch (error) {
    console.error('❌ Error sending doctor invitation:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    res.status(500).json({ 
      success: false,
      error: `Failed to send doctor invitation: ${error.message}` 
    });
  }
});

// Verify invitation token (kept for future use if you deploy to a real domain)
app.post('/verify-invitation-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const invitationData = doctorInvitations.get(token);

    if (!invitationData) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired invitation token' 
      });
    }

    if (Date.now() > invitationData.expiresAt) {
      doctorInvitations.delete(token);
      return res.status(400).json({ 
        success: false,
        error: 'Invitation token has expired' 
      });
    }

    res.status(200).json({ 
      success: true,
      email: invitationData.email,
      name: invitationData.name
    });
  } catch (error) {
    console.error('❌ Error verifying invitation token:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify invitation token' 
    });
  }
});

// Send verification code
app.post('/send-verification-code', async (req, res) => {
  const { email } = req.body;

  console.log('📧 Received request to send verification code to:', email);

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Check if email credentials are set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('❌ Missing email credentials');
    return res.status(500).json({ 
      error: 'Email service not configured' 
    });
  }

  // Check if transporter is created
  if (!transporter) {
    console.log('❌ Transporter not initialized');
    return res.status(500).json({ 
      error: 'Email service not properly configured' 
    });
  }

  try {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(email, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    console.log(`📧 Attempting to send email to: ${email}`);
    console.log(`🔑 Generated code: ${code}`);

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'TimeFly - Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">TimeFly Email Verification</h2>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; color: #4F46E5; letter-spacing: 8px; text-align: center;">${code}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    };

    console.log('📤 Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);

    res.status(200).json({ 
      success: true, 
      message: 'Verification code sent successfully' 
    });

  } catch (error) {
    console.error('❌ Error sending verification code:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    
    res.status(500).json({ 
      success: false,
      error: `Failed to send verification code: ${error.message}` 
    });
  }
});

// Verify code endpoint
app.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const storedData = verificationCodes.get(email);

    if (!storedData) {
      return res.status(400).json({ 
        success: false,
        error: 'No verification code found for this email' 
      });
    }

    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({ 
        success: false,
        error: 'Verification code has expired' 
      });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid verification code' 
      });
    }

    // Code is valid - remove it
    verificationCodes.delete(email);

    res.status(200).json({ 
      success: true,
      message: 'Email verified successfully' 
    });
  } catch (error) {
    console.error('❌ Error verifying code:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify code' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Email server running on http://localhost:${PORT}`);
  console.log(`📧 EMAIL_USER: ${process.env.EMAIL_USER}`);
  console.log(`🔑 EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Not set'}`);
});