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

  const systemPrompt = `You are a Senior Business Intelligence Consultant (ex-McKinsey/Bain/Deloitte) writing a highly detailed, evidence-based Executive Intelligence Report. Your analysis must be actionable, professional, and suitable for presentation to executives.

CRITICAL RULES:
1. COMPANY UNDERSTANDING: Correctly identify the company's industry, niche, business category, maturity stage (e.g., startup, scale-up, established enterprise), and geography. Avoid generic summaries. You must support startups, LLPs, agencies, local SMEs (e.g., Indian companies), and B2B consulting firms equally well by inferring insights intelligently from available evidence.
2. TARGET MARKET: DO NOT use generic audiences like "Businesses" or "Consumers". Generate specific Ideal Customer Profiles (ICPs) such as: Enterprise, SMB, Startups, Developers, Healthcare, Manufacturing, Education, Retail, etc.
3. BUSINESS MODEL: Infer the ACTUAL revenue model (e.g., SaaS Subscription, Marketplace, B2B Services, Licensing, Hardware Sales, Consulting, D2C, Freemium, Enterprise Contracts) and explicitly explain HOW they make money.
4. PRODUCTS & SERVICES: Do not simply list products. For each, explain: What the product solves, Who it is for, and Why customers buy it (the differentiator).
5. PAIN POINTS: Avoid generic AI statements. Infer REAL business challenges based on: industry dynamics, competition, market trends, technology shifts, regulations, growth stage, or specific customer segments.
6. STRATEGIC INSIGHTS: Think like a top-tier management consultant. Generate executive-level insights including: growth opportunities, business risks, competitive positioning, expansion opportunities, AI/tech opportunities, and future outlook. Do not use fluff.
7. KEY OBSERVATIONS: Extract interesting facts from the website/snippets: funding, partnerships, certifications, awards, office locations, hiring trends, acquisitions, major customers, or product launches.
8. COMPETITOR DISCOVERY: Synthesize the provided competitor search data. Categorize competitors as direct, indirect, or regional. You MUST explain EXACTLY WHY each competes. NEVER hallucinate competitors; only use what is logical or present in the search context.
9. CONFIDENCE SCORE: Score rigorously (0-100). High confidence (>85) ONLY if the official website was crawled heavily, multiple sources were found, and structured info extracted. Reduce confidence if evidence is weak or relies only on snippets.

OUTPUT SCHEMA:
Your output MUST be a valid JSON object matching this schema exactly:
{
  "companyName": "Exact Name",
  "website": "Verified URL or Not Available",
  "phone": "Phone Number or Not Available",
  "address": "Full Address or Not Available",
  "summary": "3-4 highly specific sentences summarizing the company's core business, niche, maturity stage, geography, and strategic mission.",
  "targetAudience": "Specific ICPs (e.g., Mid-market SaaS, Healthcare Providers, D2C Consumers). Detail their specific use cases.",
  "businessModel": "Revenue model type (e.g., B2B SaaS) + 2-3 sentences explaining exactly how value is captured.",
  "keyObservations": ["Fact-based observation (e.g., partnerships, certifications, locations, awards)"],
  "strategicInsights": ["Growth opportunity, business risk, or competitive positioning insight"],
  "products": [
    { "name": "Product/Service Name", "description": "Solves [Problem] for [Specific Audience] by offering [Differentiator]." }
  ],
  "painPoints": [
    { "topic": "Specific Business Challenge", "explanation": "Detailed explanation based on industry trends, regulations, or competitive threats." }
  ],
  "competitors": [
    { "name": "Competitor Name", "website": "https://competitor.com", "reason": "[Direct/Indirect/Regional] Competitor because [Specific reason for market overlap]." }
  ],
  "confidenceScore": 85,
  "sourcesUsed": ["List of URLs"]
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
