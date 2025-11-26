import nodemailer from 'nodemailer';

export default async function handler(req, res) {
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

  const { 
    patientEmail, 
    patientName, 
    doctor, 
    oldDate, 
    oldTime, 
    newDate, 
    newTime, 
    queueNumber 
  } = req.body;

  if (!patientEmail || !patientName) {
    return res.status(400).json({ error: 'Patient email and name are required' });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: patientEmail,
      subject: 'TimeFly - Appointment Rescheduled',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">TimeFly Healthcare</h1>
            <p style="color: #666; margin: 5px 0 0 0;">Eye Care Management System</p>
          </div>
          
          <h2 style="color: #333;">Appointment Rescheduled</h2>
          
          <p>Dear ${patientName},</p>
          
          <p>Your appointment has been rescheduled. Please find the updated details below:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">Previous Appointment:</h3>
            <p><strong>Date:</strong> ${formatDate(oldDate)}</p>
            <p><strong>Time:</strong> ${oldTime}</p>
            
            <h3 style="color: #4F46E5; margin-top: 20px;">New Appointment:</h3>
            <p><strong>Date:</strong> ${formatDate(newDate)}</p>
            <p><strong>Time:</strong> ${newTime}</p>
            ${queueNumber ? `<p><strong>Queue Number:</strong> ${queueNumber}</p>` : ''}
            <p><strong>Doctor:</strong> ${doctor}</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <p style="margin: 0; color: #856404;">
              <strong>Important:</strong> Please arrive 15 minutes before your new scheduled time. 
              If you're unable to make the new appointment, please contact us immediately to reschedule.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you have any questions or need further assistance, please don't hesitate to contact us.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This is an automated notification from TimeFly Healthcare System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true, 
      message: 'Reschedule notification sent successfully' 
    });

  } catch (error) {
    console.error('Error sending reschedule notification:', error);
    res.status(500).json({ 
      success: false,
      error: `Failed to send reschedule notification: ${error.message}` 
    });
  }
}