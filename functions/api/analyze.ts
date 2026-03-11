interface Env {
  GEMINI_API_KEY: string
}

interface AnalyzeRequest {
  profile: {
    months: number
    weight: number
    milkPerDay: number
    mealsPerDay: number
  }
  foods: string
}

function buildPrompt(profile: AnalyzeRequest['profile'], foods: string): string {
  return `あなたは離乳食の栄養アドバイザーです。

以下の条件の赤ちゃんが今日食べた離乳食の栄養バランスを評価してください。

赤ちゃんの情報:
- 月齢: ${profile.months}ヶ月
- 体重: ${profile.weight}kg
- 授乳/ミルク回数: ${profile.milkPerDay}回/日

今日の離乳食:
${foods}

以下の JSON 形式で回答してください（JSON のみ、他のテキストは不要）:
{
  "nutrients": {
    "energy": { "intake": number, "target": number, "unit": "kcal", "percentage": number },
    "protein": { "intake": number, "target": number, "unit": "g", "percentage": number },
    "iron": { "intake": number, "target": number, "unit": "mg", "percentage": number },
    "calcium": { "intake": number, "target": number, "unit": "mg", "percentage": number },
    "vitaminC": { "intake": number, "target": number, "unit": "mg", "percentage": number },
    "vitaminD": { "intake": number, "target": number, "unit": "μg", "percentage": number }
  },
  "score": number,
  "summary": "string",
  "deficiencies": [
    {
      "nutrient": "string",
      "suggestions": ["食材1", "食材2"],
      "reason": "string"
    }
  ],
  "tips": ["string"]
}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: AnalyzeRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const prompt = buildPrompt(body.profile, body.foods)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return new Response(JSON.stringify({ error: 'Empty response from AI' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = JSON.parse(text)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Analyze error:', err)
    return new Response(JSON.stringify({ error: 'Analysis failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
