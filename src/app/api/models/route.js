import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Company Researcher',
      }
    });
    
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
    
    const data = await res.json();
    
    if (!data || !Array.isArray(data.data)) {
      throw new Error('Invalid OpenRouter response format');
    }

    const EXCLUDED_KEYWORDS = ['embed', 'whisper', 'dall-e', 'stable-diffusion', 'tts', 'sdxl', 'flux', 'midjourney', 'imagen', 'video', 'audio', 'lyria', 'safety', 'guard', 'moderation', 'classifier', 'ling', 'gemma-4', 'nemotron'];

    let availableModels = data.data
      .filter(m => {
        if (!m || !m.id || typeof m.id !== 'string') return false;
        const idLower = m.id.toLowerCase();
        
        // Exclude experimental, internal router proxies, or non-text models
        if (idLower.startsWith('~') || idLower.startsWith('openrouter/')) return false;
        if (EXCLUDED_KEYWORDS.some(kw => idLower.includes(kw))) return false;
        
        return true;
      })
      .map(m => {
        const isFree = m.id.endsWith(':free') || 
          (parseFloat(m.pricing?.prompt || '1') === 0 && parseFloat(m.pricing?.completion || '1') === 0);
        return {
          id: m.id,
          name: `${isFree ? '🟢' : '🔵'} ${m.name || m.id}`
        };
      });

    // Sort: Free models first, then alphabetically by model name
    availableModels.sort((a, b) => {
      const aFree = a.name.startsWith('🟢');
      const bFree = b.name.startsWith('🟢');
      if (aFree && !bFree) return -1;
      if (!aFree && bFree) return 1;
      return a.name.localeCompare(b.name);
    });

    if (availableModels.length === 0) {
      return NextResponse.json({
        models: [
          { id: 'meta-llama/llama-3.3-70b-instruct', name: '🟢 Llama 3.3 70B Instruct' }
        ]
      });
    }

    return NextResponse.json({ models: availableModels });
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    return NextResponse.json({
      models: [
        { id: 'meta-llama/llama-3.3-70b-instruct', name: '🟢 Llama 3.3 70B Instruct (Fallback)' }
      ]
    });
  }
}
