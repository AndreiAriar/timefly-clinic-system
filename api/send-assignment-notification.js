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
    appointmentDate, 
    timeSlot, 
    queueNumber,
    assignedBy 
  } = req.body;

  if (!patientEmail || !patientName || !doctor) {
    return res.status(400).json({ error: 'Patient email, name, and doctor are required' });
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

    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: patientEmail,
      subject: 'TimeFly - Appointment Assignment Notification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">TimeFly Healthcare</h1>
            <p style="color: #666; margin: 5px 0 0 0;">Eye Care Management System</p>
          </div>
          
          <h2 style="color: #333;">Appointment Successfully Assigned! 🎉</h2>
          
          <p>Dear ${patientName},</p>
          
          <p>Great news! We're pleased to inform you that an appointment slot has become available and you have been assigned to see the doctor.</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #4F46E5;">
            <h3 style="color: #4F46E5; margin-top: 0;">Appointment Details:</h3>
            <p><strong>Doctor:</strong> ${doctor}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            ${timeSlot ? `<p><strong>Time:</strong> ${timeSlot}</p>` : ''}
            ${queueNumber ? `<p><strong>Queue Number:</strong> ${queueNumber}</p>` : ''}
            <p><strong>Status:</strong> Confirmed ✅</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <p style="margin: 0; color: #856404;">
              <strong>Important Reminder:</strong> Please arrive 30 minutes before your scheduled time. 
              Bring your ID and any relevant medical documents.
            </p>
          </div>
          
          <div style="background-color: #d1fae5; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #a7f3d0;">
            <p style="margin: 0; color: #065f46;">
              <strong>Note:</strong> This appointment was assigned from the waiting list. 
              If you need to reschedule or cancel, please contact us as soon as possible.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you have any questions or need to make changes to your appointment, 
            please contact our clinic at your earliest convenience.
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
      message: 'Assignment notification sent successfully' 
    });

  } catch (error) {
    console.error('Error sending assignment notification:', error);
    res.status(500).json({ 
      success: false,
      error: `Failed to send assignment notification: ${error.message}` 
    });
  }
}