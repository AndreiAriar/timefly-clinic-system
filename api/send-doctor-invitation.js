import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Store invitations in memory (for production, use a database)
const doctorInvitations = new Map();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name } = req.body;

  console.log('📧 Received request to send doctor invitation to:', email);

  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('❌ Missing email credentials');
    return res.status(500).json({ 
      error: 'Email service not configured' 
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Generate secure token for password setup
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    // Store invitation data
    doctorInvitations.set(token, {
      email,
      name,
      expiresAt,
      createdAt: Date.now()
    });

    // Get the base URL for the password setup link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:5173';
    
    const setupUrl = `${baseUrl}/setup-password?token=${token}`;

    console.log(`📧 Attempting to send doctor invitation to: ${email}`);
    console.log(`🔑 Generated token: ${token}`);
    console.log(`🔗 Setup URL: ${setupUrl}`);

    // Send email with password setup link
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
              <a href="${setupUrl}" 
                 style="display: inline-block; padding: 15px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Set Up Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${setupUrl}
            </p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <p style="color: #856404; margin: 0;">
              <strong>⚠️ Important:</strong> This link will expire in 24 hours. If it expires, please contact the system administrator to resend the invitation.
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

    res.status(200).json({ 
      success: true, 
      message: 'Doctor invitation sent successfully',
      token: token // Include token in response for testing (remove in production)
    });

  } catch (error) {
    console.error('❌ Error sending doctor invitation:', error.message);
    
    res.status(500).json({ 
      success: false,
      error: `Failed to send doctor invitation: ${error.message}` 
    });
  }
}

// Export the invitations map for use in verify-token endpoint
export { doctorInvitations };