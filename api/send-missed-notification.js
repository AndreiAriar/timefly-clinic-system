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

  const { patientEmail, patientName, appointmentDate, timeSlot, doctor, queueNumber } = req.body;

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

    const formatTime = (timeString) => {
      if (!timeString) return 'N/A';
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: patientEmail,
      subject: 'TimeFly - Missed Appointment Notification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">TimeFly Healthcare</h1>
            <p style="color: #666; margin: 5px 0 0 0;">Eye Care Management System</p>
          </div>

          <h2 style="color: #333;">Missed Appointment Notification</h2>

          <p>Dear ${patientName},</p>

          <p>We noticed that you were unable to attend your scheduled appointment. We understand that sometimes circumstances prevent you from keeping your appointment.</p>

          <div style="background-color: #fef2f2; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #fecaca;">
            <h3 style="color: #dc2626; margin-top: 0;">Missed Appointment Details:</h3>
            ${queueNumber ? `<p><strong>Queue Number:</strong> #${queueNumber}</p>` : ''}
            ${doctor ? `<p><strong>Doctor:</strong> ${doctor}</p>` : ''}
            ${appointmentDate ? `<p><strong>Date:</strong> ${formatDate(appointmentDate)}</p>` : ''}
            ${timeSlot ? `<p><strong>Time:</strong> ${formatTime(timeSlot)}</p>` : ''}
            <p><strong>Status:</strong> <span style="color: #dc2626;">Missed</span></p>
          </div>

          <div style="background-color: #fffbeb; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #fef3c7;">
            <p style="margin: 0; color: #92400e;">
              <strong>Next Steps:</strong> If you still need medical attention, please contact us to reschedule your appointment. We're here to help you get the care you need.
            </p>
          </div>

          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #bae6fd;">
            <p style="margin: 0; color: #0369a1;">
              <strong>Rescheduling:</strong> You can book a new appointment through our online system or by calling our clinic directly. We'll do our best to accommodate your schedule.
            </p>
          </div>

          <p style="color: #666; font-size: 14px;">
            If you have any questions or need assistance with rescheduling, please don't hesitate to contact our front desk.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This is an automated notification from TimeFly Healthcare System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Missed appointment notification sent to ${patientEmail}`);

    res.status(200).json({ 
      success: true, 
      message: 'Missed appointment notification sent successfully' 
    });

  } catch (error) {
    console.error('Error sending missed appointment notification:', error);
    res.status(500).json({ 
      success: false,
      error: `Failed to send missed appointment notification: ${error.message}`
    });
  }
}