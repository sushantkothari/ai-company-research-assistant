import axios from 'axios';

export async function analyzeCompanyData(prompt, model = 'openai/gpt-4o-mini') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set.');
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are an expert AI Company Research Analyst. Your job is to extract highly accurate, professional insights about a company based ONLY on the provided web scraping and search data. Do NOT hallucinate information. If data is missing, omit the field or write "Not found".

            Respond ONLY in valid JSON format matching EXACTLY this structure:
            {
              "companyName": "Exact Name",
              "website": "Verified URL",
              "phone": "Phone Number if found",
              "address": "Full Address if found",
              "summary": "3-4 highly professional sentences summarizing the company's core business, history, and mission.",
              "products": ["Product/Service 1", "Product/Service 2"],
              "painPoints": ["Insightful AI-generated pain point 1", "Insightful AI-generated pain point 2"],
              "competitors": [
                { "name": "Competitor 1", "website": "URL" }
              ],
              "confidenceScore": 85, // Integer 0-100 indicating how confident you are in this data
              "sourcesUsed": ["List of URLs or search queries you relied on"]
            }
            Do not include any markdown formatting like \`\`\`json, return ONLY the raw JSON object.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://reluconsultancy.in',
          'X-Title': 'Relu AI Researcher',
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60s timeout for LLM
      }
    );

    const content = response.data.choices[0].message.content;
    
    // Safely parse JSON, stripping markdown if the AI ignored the instruction
    const cleanJson = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    
    // Ensure all required fields exist to prevent frontend crashes
    return {
      companyName: parsed.companyName || 'Unknown',
      website: parsed.website || '',
      phone: parsed.phone || '',
      address: parsed.address || '',
      summary: parsed.summary || 'No summary available.',
      products: Array.isArray(parsed.products) ? parsed.products : [],
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0,
      sourcesUsed: Array.isArray(parsed.sourcesUsed) ? parsed.sourcesUsed : []
    };

  } catch (error) {
    console.error('OpenRouter API error:', error?.response?.data || error.message);
    throw new Error(error?.response?.data?.error?.message || 'Failed to generate AI analysis.');
  }
}
