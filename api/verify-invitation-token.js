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

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const doctorInvitations = global.doctorInvitations || new Map();
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
}