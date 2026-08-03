const fs = require('fs');
const path = require('path');

async function testDiscord() {
  try {
    const pdfBuffer = fs.readFileSync(path.join(__dirname, '../outputs/Microsoft_Report.pdf'));
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', pdfBlob, 'report.pdf');
    
    const dataObj = {
      companyName: 'Microsoft',
      website: 'https://microsoft.com',
      applicantName: 'Test',
      applicantEmail: 'test@example.com',
      channelId: '1335969566270685227', // The actual one they are using or a dummy
      token: 'Bot dummytoken' // Doesn't matter, we just want to see the error from Discord API
    };
    
    formData.append('data', new Blob([JSON.stringify(dataObj)], { type: 'application/json' }));

    const res = await fetch('http://localhost:3000/api/discord', {
      method: 'POST',
      body: formData
    });

    const resData = await res.json();
    console.log(resData);
  } catch(e) {
    console.error(e);
  }
}

testDiscord();
