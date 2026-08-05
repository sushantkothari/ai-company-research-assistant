import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Company Researcher',
      }
    });
    const data = await res.json();
    
    // Define some top high-tier models we specifically want
    const preferredModels = [
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-r1',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/o3-mini',
      'mistralai/mistral-large-2411',
      'cohere/command-r-plus-08-2024',
      'x-ai/grok-2-1212',
      'google/gemini-2.5-pro',
      'meta-llama/llama-3.1-405b-instruct',
      'qwen/qwen-2.5-72b-instruct'
    ];

    let availableModels = data.data
      .filter(m => preferredModels.includes(m.id) || m.pricing.prompt === '0') // keep preferred + some free
      .map(m => {
        const isFree = parseFloat(m.pricing?.prompt || '0') === 0 && parseFloat(m.pricing?.completion || '0') === 0;
        return {
          id: m.id,
          name: `${isFree ? '🟢' : '🔵'} ${m.name}`
        };
      });
      
    // Sort so preferred ones are at top, free ones first
    availableModels.sort((a, b) => {
      const aPref = preferredModels.indexOf(a.id);
      const bPref = preferredModels.indexOf(b.id);
      if (aPref !== -1 && bPref !== -1) return aPref - bPref;
      if (aPref !== -1) return -1;
      if (bPref !== -1) return 1;
      const aFree = a.name.includes('🟢');
      const bFree = b.name.includes('🟢');
      if (aFree && !bFree) return -1;
      if (!aFree && bFree) return 1;
      return 0;
    });

    // Keep top 15
    const finalModels = availableModels.slice(0, 15);

    // Fallback if OpenRouter API fails
    if (finalModels.length === 0) {
       return NextResponse.json({ models: [
         { id: 'meta-llama/llama-3.3-70b-instruct', name: '🟢 Llama 3.3 70B Instruct' },
         { id: 'anthropic/claude-3.5-sonnet', name: '🔵 Claude 3.5 Sonnet' }
       ]});
    }

    return NextResponse.json({ models: finalModels });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json({
      models: [
        { id: 'meta-llama/llama-3.3-70b-instruct', name: '🟢 Llama 3.3 70B Instruct (Fallback)' },
        { id: 'google/gemini-2.5-flash', name: '🟢 Gemini 2.5 Flash' },
        { id: 'anthropic/claude-3.5-sonnet', name: '🔵 Claude 3.5 Sonnet' }
      ]
    });
  }
}
