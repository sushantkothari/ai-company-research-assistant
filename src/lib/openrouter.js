import axios from 'axios';

function validateSchema(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!parsed.companyName || typeof parsed.companyName !== 'string' || parsed.companyName.trim() === '') return false;
  if (!parsed.summary || typeof parsed.summary !== 'string' || parsed.summary.trim() === '') return false;
  if (!Array.isArray(parsed.products) || parsed.products.length === 0) return false;
  if (!Array.isArray(parsed.painPoints) || parsed.painPoints.length === 0) return false;
  if (!Array.isArray(parsed.competitors)) return false;
  if (!parsed.businessModel || typeof parsed.businessModel !== 'string' || parsed.businessModel.trim() === '') return false;
  if (!Array.isArray(parsed.strategicInsights) || parsed.strategicInsights.length === 0) return false;
  if (!Array.isArray(parsed.keyObservations) || parsed.keyObservations.length === 0) return false;
  return true;
}

export async function analyzeCompanyData(prompt, model = 'meta-llama/llama-3.3-70b-instruct', clientApiKey = '') {
  const apiKey = (clientApiKey || process.env.OPENROUTER_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing. Please provide a valid OpenRouter API key.');
  }

  const systemPrompt = `You are a Senior Business Intelligence Analyst writing an Executive Intelligence Report. Extract accurate, highly professional insights about a company based on the provided web scraping and search data.

CRITICAL RULES:
1. EXECUTIVE QUALITY: Use professional, high-level business language. Provide deep strategic positioning, business model analysis, and key observations rather than surface-level summaries.
2. DEDUCE WHEN POSSIBLE: If specific information (like Target Audience or Products) is not perfectly explicitly listed, intelligently deduce it based on the Google Search Context and industry knowledge. DO NOT output "Not Available" for major sections unless absolutely zero context exists. 
3. EVIDENCE-BASED COMPETITIVE ANALYSIS:
   - Identify specific, real-world competitor companies inferred from the provided search data and industry context.
   - You MUST provide a specific reason for why they are a competitor, focusing on strategic differentiators and market overlap.
4. OUTPUT SCHEMA:
   - Your output MUST be a valid JSON object matching this schema exactly:
{
  "companyName": "Exact Name",
  "website": "Verified URL or Not Available",
  "phone": "Phone Number or Not Available (only if truly missing)",
  "address": "Full Address or Not Available (only if truly missing)",
  "summary": "3-4 objective sentences summarizing the company's core business, history, and strategic mission.",
  "targetAudience": "Target audience and market positioning (deduce from industry context if needed).",
  "businessModel": "2-3 sentences explaining how the company generates revenue and captures value (deduce from industry context if needed).",
  "keyObservations": ["Observation 1", "Observation 2"],
  "strategicInsights": ["Strategic Insight 1", "Strategic Insight 2"],
  "products": [
    { "name": "Product or Service Name", "description": "1-2 sentences explaining its value proposition and strategic differentiators." }
  ],
  "painPoints": [
    { "topic": "Core Pain Point Topic", "explanation": "2-3 insightful sentences explaining the reasoning based on industry dynamics and customer challenges." }
  ],
  "competitors": [
    { "name": "Competitor Company Name", "website": "https://competitor.com", "reason": "Specific strategic overlap or differentiator." }
  ],
  "confidenceScore": 90,
  "sourcesUsed": ["List of URLs relied on"]
}
Do not wrap JSON in markdown (no \`\`\`json). Return ONLY raw JSON.`;

  const makeRequest = async (messages) => {
    return await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model,
        messages: messages,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://reluconsultancy.in',
          'X-Title': 'AI Company Research Assistant',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
  };

  const parseAndNormalize = (rawContent) => {
    const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Preserve exact AI output strings while normalizing structural types
    const companyName = (parsed.companyName || 'Unknown Company').trim();
    const website = (parsed.website || 'Not Available').trim();
    const phone = (parsed.phone || 'Not Available').trim();
    const address = (parsed.address || 'Not Available').trim();
    const summary = (parsed.summary || 'Summary Not Available').trim();
    const targetAudience = (parsed.targetAudience || 'Not Available').trim();

    const products = (Array.isArray(parsed.products) ? parsed.products : []).map(p => {
      if (typeof p === 'string') return { name: p.trim(), description: '' };
      return {
        name: (p.name || p.title || p.product || 'Product/Service').trim(),
        description: (p.description || p.explanation || p.desc || '').trim()
      };
    });

    const painPoints = (Array.isArray(parsed.painPoints) ? parsed.painPoints : []).map(p => {
      if (typeof p === 'string') return { topic: p.trim(), explanation: '' };
      return {
        topic: (p.topic || p.title || p.name || 'Industry Challenge').trim(),
        explanation: (p.explanation || p.description || p.reason || '').trim()
      };
    });

    const competitors = (Array.isArray(parsed.competitors) ? parsed.competitors : []).map(c => {
      if (typeof c === 'string') return { name: c.trim(), website: 'Not Available', reason: 'Industry competitor' };
      const web = (c.website || c.url || c.link || 'Not Available').trim();
      return {
        name: (c.name || c.company || 'Competitor').trim(),
        website: web.startsWith('http') || web === 'Not Available' ? web : `https://${web}`,
        reason: (c.reason || c.description || c.explanation || 'Market competitor').trim()
      };
    });

    const businessModel = (parsed.businessModel || 'Not Available').trim();
    
    const extractStringArray = (arr, fallback) => {
      if (!Array.isArray(arr) || arr.length === 0) return [fallback];
      return arr.map(a => typeof a === 'string' ? a.trim() : JSON.stringify(a)).filter(a => a.length > 0);
    };

    const strategicInsights = extractStringArray(parsed.strategicInsights, 'Strategic insights unavailable from current evidence.');
    const keyObservations = extractStringArray(parsed.keyObservations, 'Key observations unavailable from current evidence.');

    return {
      companyName,
      website,
      phone,
      address,
      summary,
      targetAudience,
      businessModel,
      keyObservations,
      strategicInsights,
      products: products.length > 0 ? products : [{ name: 'Core Offerings', description: 'Product details not available in retrieved data.' }],
      painPoints: painPoints.length > 0 ? painPoints : [{ topic: 'Market Dynamics', explanation: 'Competitive dynamics in operating segment.' }],
      competitors: competitors,
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 85,
      sourcesUsed: Array.isArray(parsed.sourcesUsed) ? parsed.sourcesUsed : []
    };
  };

  // --- ATTEMPT 1 ---
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const response = await makeRequest(messages);
    const content = response.data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenRouter API returned empty choices.');
    }

    try {
      const parsedRaw = JSON.parse(content.replace(/```json/gi, '').replace(/```/g, '').trim());
      if (validateSchema(parsedRaw)) {
        return parseAndNormalize(content);
      } else {
        console.warn('Schema validation failed on Attempt 1, executing 1 retry...');
      }
    } catch (parseErr) {
      console.warn('JSON parsing failed on Attempt 1, executing 1 retry...');
    }

    // --- RETRY 1 ---
    const retryMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
      { role: 'assistant', content: content },
      { role: 'user', content: 'Your previous response did not strictly match the JSON schema or failed validation. Return ONLY valid raw JSON with non-empty products, painPoints, strategicInsights, and keyObservations arrays, and a valid businessModel string. For competitors, provide an empty array [] if no specific competitors are found in the evidence. DO NOT hallucinate.' }
    ];

    const retryResponse = await makeRequest(retryMessages);
    const retryContent = retryResponse.data?.choices?.[0]?.message?.content;

    if (!retryContent) {
      throw new Error('OpenRouter API returned empty choices on retry.');
    }

    return parseAndNormalize(retryContent);

  } catch (error) {
    console.error('OpenRouter API Error:', error?.response?.data || error.message);
    throw new Error(`OpenRouter API request failed: ${error?.response?.data?.error?.message || error.message}`);
  }
}
