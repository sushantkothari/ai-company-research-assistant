import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file'); // PDF Blob
    const dataStr = formData.get('data');

    if (!file || !dataStr) {
      return NextResponse.json({ error: 'Missing file or data' }, { status: 400 });
    }

    const data = JSON.parse(dataStr);
    const { companyName, website, applicantName, applicantEmail, channelId, token } = data;

    if (!token || !channelId) {
      return NextResponse.json({ error: 'Discord config missing' }, { status: 400 });
    }

    // Convert file Blob to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Prepare Discord message payload
    const discordPayload = new FormData();
    const messageContent = `**New Company Research Report Generated!**\n\n` +
      `**Applicant Details:**\n` +
      `- Name: ${applicantName || 'Not Provided'}\n` +
      `- Email: ${applicantEmail || 'Not Provided'}\n\n` +
      `**Research Details:**\n` +
      `- Company: ${companyName}\n` +
      `- Website: ${website}\n\n` +
      `Please find the generated PDF report attached.`;

    discordPayload.append('content', messageContent);
    discordPayload.append('file', new Blob([buffer], { type: 'application/pdf' }), `${companyName.replace(/\s+/g, '_')}_Report.pdf`);

    // We can use a Discord Webhook OR Bot API.
    // The requirement says "Discord Bot Token" and "Discord Channel ID".
    // Discord Bot API endpoint: POST /channels/{channel.id}/messages
    
    const discordResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`
      },
      body: discordPayload // FormData automatically sets correct multipart boundaries
    });

    if (!discordResponse.ok) {
      const errText = await discordResponse.text();
      console.error('Discord API Error:', errText);
      return NextResponse.json({ error: 'Failed to send to Discord' }, { status: discordResponse.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Discord API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
