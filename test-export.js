const axios = require('axios');

async function testExport() {
  try {
    console.log('Testing export API...');
    
    // ทดสอบการเรียก API export
    const response = await axios.get('http://localhost:4000/api/a2rpt/export', {
      params: {
        name: 'ท่อดำ #1',
        year: 2024,
        month: 6
      },
      responseType: 'blob'
    });
    
    console.log('Export successful');
    console.log('Response headers:', response.headers);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Data size:', response.data.length, 'bytes');
    
  } catch (error) {
    console.error('Export failed');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      
      // พยายามอ่าน error response
      try {
        const errorText = await error.response.data.text();
        console.error('Error response:', errorText);
        
        // พยายาม parse เป็น JSON
        try {
          const errorData = JSON.parse(errorText);
          console.error('Parsed error:', errorData);
        } catch (parseError) {
          console.error('Could not parse error as JSON');
        }
      } catch (readError) {
        console.error('Could not read error response');
      }
    }
  }
}

testExport(); 