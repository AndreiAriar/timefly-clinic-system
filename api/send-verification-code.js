import nodemailer from 'nodemailer';

// In-memory storage (consider using Vercel KV or database for production)
const verificationCodes = new Map();

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

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

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

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);

    res.status(200).json({ 
      success: true, 
      message: 'Verification code sent successfully' 
    });

  } catch (error) {
    console.error('❌ Error sending verification code:', error.message);
    
    res.status(500).json({ 
      success: false,
      error: `Failed to send verification code: ${error.message}` 
    });
  }

  // Export codes for verify-code function to access
  global.verificationCodes = verificationCodes;
}