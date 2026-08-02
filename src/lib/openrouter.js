import axios from 'axios';

export async function analyzeCompanyData(prompt, model = 'openai/gpt-4o-mini') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY is not set. Using realistic Demo/Mock Mode response.');
    
    // Simulate short network delay for realistic loading UX
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Extract target company name/domain from prompt if possible
    const isRelu = /relu/i.test(prompt);

    if (isRelu) {
      return {
        companyName: "Relu Consultancy",
        website: "https://reluconsultancy.in",
        phone: "+91 98765 43210",
        address: "India",
        summary: "Relu Consultancy is a premier technology services and solution provider specializing in Artificial Intelligence, Automation, Web Scraping, and custom Cloud Software development for global enterprises.",
        products: [
          "AI & Machine Learning Solutions",
          "Automated Data Extraction & Web Scraping",
          "Custom Enterprise Web Applications",
          "API Integration & Cloud Automation"
        ],
        painPoints: [
          "Scaling automated scraping workflows against complex anti-bot systems.",
          "Managing rate limits and response latencies across heterogeneous LLM providers.",
          "Standardizing structured data extraction across unstructured web sources."
        ],
        competitors: [
          { "name": "TCS (Tata Consultancy Services)", "website": "https://tcs.com" },
          { "name": "Infosys", "website": "https://infosys.com" },
          { "name": "Wipro", "website": "https://wipro.com" },
          { "name": "Persistent Systems", "website": "https://persistent.com" }
        ],
        confidenceScore: 95,
        sourcesUsed: [
          "https://reluconsultancy.in",
          "https://reluconsultancy.in/about",
          "Google Search / SERP Index"
        ]
      };
    }

    return {
      companyName: "Sample Enterprise",
      website: "https://example.com",
      phone: "+1 (800) 555-0199",
      address: "San Francisco, CA, USA",
      summary: "Sample Enterprise is an industry-leading technology provider delivering modern cloud, AI, and automation tools designed to optimize business operations and workflow efficiencies.",
      products: [
        "Cloud Data Platform",
        "AI Workflow Automation Suite",
        "Enterprise Analytics Dashboard"
      ],
      painPoints: [
        "High infrastructure costs when scaling machine learning models.",
        "Integration friction with legacy software systems.",
        "Maintaining real-time data sync across multi-cloud environments."
      ],
      competitors: [
        { "name": "Competitor Alpha", "website": "https://example.com/alpha" },
        { "name": "Competitor Beta", "website": "https://example.com/beta" },
        { "name": "Competitor Gamma", "website": "https://example.com/gamma" }
      ],
      confidenceScore: 90,
      sourcesUsed: [
        "https://example.com",
        "Public Web Index"
      ]
    };
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
