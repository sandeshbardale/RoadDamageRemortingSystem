const { GoogleGenerativeAI } = require('@google/generative-ai');

const VALID_CATEGORIES = ['POTHOLE', 'CRACK', 'EDGE_FAILURE', 'WATERLOGGING', 'SURFACE_DAMAGE', 'OTHER'];

const getModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

// ─── 0. IMAGE VALIDATION — reject non-road-damage images ─────────────────────
// Called BEFORE uploading/saving. Returns { valid, reason } immediately.
// Rejects: selfies, food, animals, nature, interior shots, etc.
const validateRoadImage = async (imageBuffer, mimeType = 'image/jpeg') => {
  const model = getModel();
  if (!model) {
    // If Gemini not configured, allow all images (graceful fallback)
    return { valid: true, reason: null };
  }

  try {
    const prompt = `You are an image validation system for a road damage reporting app.

Your ONLY job: decide if this image shows road/street/pavement damage or road infrastructure problems.

VALID images (must accept):
- Potholes, cracks, road surface damage
- Waterlogging on roads
- Road edge failures, broken curbs
- Damaged footpaths / pavements
- Manholes, broken road barriers
- Any road or street visible with damage

INVALID images (must reject):
- Selfies, portraits, people photos
- Food, drinks, household items
- Animals, pets
- Indoor scenes, rooms, buildings interior
- Nature scenes with no road damage (parks, forests, sky)
- Screenshots, memes, documents
- Blank / blurry / unrecognisable images
- Any image that clearly does not show road damage

Respond with ONLY valid JSON, no markdown:
{
  "valid": true|false,
  "confidence": 0-100,
  "reason": "brief reason if invalid, null if valid",
  "whatIsShown": "describe what the image actually shows in 5 words"
}`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
    ]);

    const raw     = result.response.text().trim();
    const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return { valid: true, reason: null }; // parse failure → allow
    }

    console.log(`🔍 Image validation: valid=${parsed.valid}, what="${parsed.whatIsShown}", confidence=${parsed.confidence}`);

    return {
      valid:       parsed.valid === true,
      confidence:  parsed.confidence || 0,
      reason:      parsed.reason   || null,
      whatIsShown: parsed.whatIsShown || '',
    };

  } catch (err) {
    console.error('Image validation error (allowing):', err.message);
    return { valid: true, reason: null }; // On error, allow (don't block citizen)
  }
};


// ─── 1. AI DAMAGE DETECTION ───────────────────────────────────────────────────
// Analyses an uploaded image and automatically detects:
//   - damage category (POTHOLE / CRACK / etc.)
//   - severity
//   - safety risk
//   - recommended action
const analyzeRoadDamage = async (imageBuffer, mimeType = 'image/jpeg') => {
  const model = getModel();
  if (!model) {
    return { available: false, message: 'Gemini API key not configured.' };
  }

  try {
    const prompt = `You are an expert road damage inspector AI for Chhatrapati Sambhajinagar Municipal Corporation.

Carefully analyze this road damage image and respond with ONLY a valid JSON object. No markdown, no explanation — just JSON.

Required JSON format:
{
  "detectedCategory": "POTHOLE|CRACK|EDGE_FAILURE|WATERLOGGING|SURFACE_DAMAGE|OTHER",
  "confidence": "High|Medium|Low",
  "damageLabel": "human readable damage name e.g. Deep Pothole",
  "severity": "Critical|High|Medium|Low",
  "estimatedSize": "e.g. Large (>100cm) or Small (<30cm)",
  "safetyRisk": "Yes|No",
  "safetyDetail": "brief reason",
  "recommendedAction": "brief action e.g. Immediate filling required",
  "urgency": "Immediate|Within 7 days|Within 30 days",
  "additionalNotes": "any other observations"
}

Choose detectedCategory from exactly these values only:
- POTHOLE: circular/oval holes in road surface
- CRACK: linear or map cracks on surface
- EDGE_FAILURE: road edge crumbling or breaking away
- WATERLOGGING: water pooling, drainage issues
- SURFACE_DAMAGE: general surface deterioration, rutting, raveling
- OTHER: anything else (manholes, barriers, etc.)`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
    ]);

    const raw = result.response.text().trim();
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: extract JSON object from text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Could not parse Gemini response as JSON');
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(parsed.detectedCategory)) {
      parsed.detectedCategory = 'OTHER';
    }

    return {
      available: true,
      detectedCategory:  parsed.detectedCategory,
      confidence:        parsed.confidence || 'Medium',
      damageLabel:       parsed.damageLabel || parsed.detectedCategory,
      severity:          parsed.severity || 'Medium',
      estimatedSize:     parsed.estimatedSize || 'Unknown',
      safetyRisk:        parsed.safetyRisk || 'No',
      safetyDetail:      parsed.safetyDetail || '',
      recommendedAction: parsed.recommendedAction || '',
      urgency:           parsed.urgency || 'Within 7 days',
      additionalNotes:   parsed.additionalNotes || '',
      analyzedAt:        new Date().toISOString(),
    };

  } catch (err) {
    console.error('Gemini damage analysis error:', err.message);
    const isInvalidKey = err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid');
    return {
      available: false,
      message: isInvalidKey
        ? 'Gemini API key is invalid or not activated in Render environment variables.'
        : `AI analysis currently unavailable: ${err.message}`,
    };
  }
};

// ─── 2. DUPLICATE DESCRIPTION ANALYSIS ───────────────────────────────────────
// Uses Gemini to check if two complaint descriptions + categories describe
// the same road damage issue (semantic duplicate detection).
const checkSemanticDuplicate = async (newDesc, newCategory, existingDesc, existingCategory) => {
  const model = getModel();
  if (!model) return { isDuplicate: false, confidence: 0 };

  try {
    const prompt = `You are a road damage duplicate detection system.

Compare these two road damage complaints and determine if they describe the SAME physical damage.

Complaint A (NEW):
Category: ${newCategory}
Description: "${newDesc || 'No description provided'}"

Complaint B (EXISTING):
Category: ${existingCategory}
Description: "${existingDesc || 'No description provided'}"

Respond with ONLY valid JSON:
{
  "isDuplicate": true|false,
  "confidence": 0-100,
  "reason": "brief explanation"
}

Consider them duplicates if:
- Same damage type AND same location indicators
- Very similar descriptions of same damage
- Confidence > 70 = likely duplicate`;

    const result = await model.generateContent([prompt]);
    const raw     = result.response.text().trim();
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return { isDuplicate: false, confidence: 0 };
    }

    return {
      isDuplicate: parsed.isDuplicate === true && (parsed.confidence || 0) >= 70,
      confidence:  parsed.confidence || 0,
      reason:      parsed.reason || '',
    };
  } catch (err) {
    console.error('Gemini duplicate check error:', err.message);
    return { isDuplicate: false, confidence: 0 };
  }
};

module.exports = { validateRoadImage, analyzeRoadDamage, checkSemanticDuplicate };
