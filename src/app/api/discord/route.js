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

    // Convert file Blob to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${(companyName || 'company').replace(/\s+/g, '_')}_Report.pdf`;

    const messageContent = `**New Company Research Report Generated!**\n\n` +
      `**Applicant Details:**\n` +
      `- Name: ${applicantName || 'Not Provided'}\n` +
      `- Email: ${applicantEmail || 'Not Provided'}\n\n` +
      `**Research Details:**\n` +
      `- Company: ${companyName}\n` +
      `- Website: ${website}\n\n` +
      `Please find the generated PDF report attached below.`;

    // Official Discord API v10 Multipart Format
    const discordPayload = new FormData();
    discordPayload.append('payload_json', JSON.stringify({
      content: messageContent
    }));

    const pdfFile = new File([buffer], fileName, { type: 'application/pdf' });
    discordPayload.append('files[0]', pdfFile);

    const discordResponse = await fetch(`https://discord.com/api/v10/channels/${channelId.trim()}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token.trim()}`
      },
      body: discordPayload
    });

    if (!discordResponse.ok) {
      const errText = await discordResponse.text();
      console.error('Discord API Error Response:', errText);
      return NextResponse.json({ error: `Discord API Error: ${discordResponse.status}` }, { status: discordResponse.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Discord API Internal Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
