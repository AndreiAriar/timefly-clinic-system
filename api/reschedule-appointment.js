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
    appointmentDate, 
    timeSlot, 
    patientEmail, 
    patientName, 
    doctor, 
    queueNumber, 
    oldDate, 
    oldTimeSlot,
    rescheduleReason 
  } = req.body;

  if (!appointmentDate || !timeSlot) {
    return res.status(400).json({ error: 'New appointment date and time slot are required' });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    // Send email notification if patient email is provided
    if (patientEmail && patientName) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      };

      const formatTime = (timeString) => {
        if (!timeString) return 'N/A';
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
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

            <p>Your appointment has been successfully rescheduled. Please see the updated details below.</p>

            ${oldDate && oldTimeSlot ? `
              <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #fecaca;">
                <h3 style="color: #991b1b; margin-top: 0;">Previous Appointment:</h3>
                <p><strong>Date:</strong> ${formatDate(oldDate)}</p>
                <p><strong>Time:</strong> ${formatTime(oldTimeSlot)}</p>
                ${rescheduleReason ? `<p><strong>Reason:</strong> ${rescheduleReason}</p>` : ''}
              </div>
            ` : ''}

            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #86efac;">
              <h3 style="color: #166534; margin-top: 0;">New Appointment Details:</h3>
              ${queueNumber ? `<p><strong>Queue Number:</strong> #${queueNumber}</p>` : ''}
              ${doctor ? `<p><strong>Doctor:</strong> ${doctor}</p>` : ''}
              <p><strong>Date:</strong> ${formatDate(appointmentDate)}</p>
              <p><strong>Time:</strong> ${formatTime(timeSlot)}</p>
              <p><strong>Status:</strong> <span style="color: #166534;">Rescheduled</span></p>
            </div>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
              <p style="margin: 0; color: #856404;">
                <strong>Important:</strong> Please arrive 30 minutes before your scheduled appointment time. If you need to make any further changes, please contact us immediately.
              </p>
            </div>

            <p style="color: #666; font-size: 14px;">
              If you have any questions or concerns about your rescheduled appointment, please don't hesitate to contact us.
            </p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
              <p>This is an automated notification from TimeFly Healthcare System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Reschedule email sent to ${patientEmail}`);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Appointment rescheduled successfully' 
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({ 
      success: false,
      error: `Failed to reschedule appointment: ${error.message}`
    });
  }
}