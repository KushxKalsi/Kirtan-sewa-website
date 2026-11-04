// Punjabi (Gurmukhi) wording for a kirtan poster, written by Claude. The poster itself is drawn in the browser with a
// Gurmukhi font, so the letters are always correct; Claude only chooses and translates the words.
// Needs ANTHROPIC_API_KEY; without it the team member types the wording themselves.
import Anthropic from '@anthropic-ai/sdk';

export const posterAiOn = !!process.env.ANTHROPIC_API_KEY;
const client = posterAiOn ? new Anthropic() : null;

const FIELDS = {
  occasion: 'Line 1 of the title banner: the occasion, e.g. ਪ੍ਰਕਾਸ਼ ਪੁਰਬ or ਗੁਰਗੱਦੀ ਦਿਵਸ or ਸ਼੍ਰੀ ਸੁਖਮਨੀ ਸਾਹਿਬ ਦਾ ਪਾਠ — max 4 words',
  occasionFor: 'Line 2 of the title banner: whose day it is, e.g. ਸ੍ਰੀ ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ; empty string if the occasion is not a Gurpurab',
  program: 'What the jatha does, e.g. ਕੀਰਤਨ ਹਾਜ਼ਰੀ or ਆਸਾ ਦੀ ਵਾਰ ਕੀਰਤਨ — max 4 words',
  place: 'The village / town / venue in Gurmukhi, prefixed with ਪਿੰਡ: for a village or ਸਥਾਨ: for any other place',
  name: 'The team member’s name in Gurmukhi with the honorific they use (e.g. ਭਾਈ, ਬਾਬਾ, ਗਿਆਨੀ) — keep their own title if given',
  nameLine: 'Short line under the name: where they are from in the usual "… ਵਾਲੇ" form, or their jatha (e.g. ਸੋਹਾਣੇ ਵਾਲੇ); empty string if unknown',
  timeLabel: 'One Gurmukhi word for the time of day of the start time: ਸਵੇਰੇ, ਦੁਪਹਿਰ, ਸ਼ਾਮ or ਰਾਤ',
};
const schema = {
  type: 'object',
  properties: Object.fromEntries(Object.entries(FIELDS).map(([k, description]) => [k, { type: 'string', description }])),
  required: Object.keys(FIELDS),
  additionalProperties: false,
};

const SYSTEM = `You write the Punjabi wording for Sikh kirtan program posters, in Gurmukhi script, the way Gurdwara and village posters in Punjab are written. Use respectful, standard Gurmukhi spellings (SGPC style) for Gurus, Banis and occasions. Transliterate personal and place names into Gurmukhi as they are pronounced in Punjab; never translate a name's meaning. Keep every field short — it must fit one line of a poster. Answer only with the JSON object.`;

/** details: { occasion, gurpurab, sewa, category, venue, memberName, memberFrom, date, start, end } (English or Punjabi). */
export async function writePosterText(details) {
  if (!client) throw Object.assign(new Error('AI poster wording is not set up (ANTHROPIC_API_KEY). Type the wording yourself.'), { status: 400 });
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    // A short translation job: low effort is plenty.
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    // If a safety check declines the request, the API retries it on a fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: `Write the poster wording for this kirtan program:\n${JSON.stringify(details, null, 2)}` }],
  });
  if (response.stop_reason === 'refusal') throw Object.assign(new Error('The AI could not write this poster. Type the wording yourself.'), { status: 400 });
  const text = response.content.find((b) => b.type === 'text')?.text || '';
  try {
    const out = JSON.parse(text);
    return Object.fromEntries(Object.keys(FIELDS).map((k) => [k, String(out[k] || '').trim().slice(0, 80)]));
  } catch {
    throw Object.assign(new Error('The AI answer could not be read. Please try again.'), { status: 400 });
  }
}
