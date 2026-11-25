// Node: Config
// The ONLY node you need to edit before a run.
return [{
  json: {
    prompt_version: 'v2',            // 'v1' (naive baseline) or 'v2' (final)
    only_ids: [],                    // e.g. ['E01','E02','E03'] to run a subset; [] = all 25
    sheet_url: 'https://docs.google.com/spreadsheets/d/1TBriSEXELV0-44-jRGRaFEO3Oadivvxn0waNB10aIJY/edit',
    // LLM: Groq (OpenAI-compatible API). Gemini 3.8 Flash free tier returned only 429/503 for this project.
    llm_url: 'https://api.groq.com/openai/v1/chat/completions',
    classifier_model: 'openai/gpt-oss-120b',
    confidence_threshold: 0.75,      // below this -> needs_human
    delay_seconds: 30,               // pause between emails (Groq free tier tokens-per-minute limit)
    // Groq list prices for openai/gpt-oss-120b (USD per 1M tokens); used for cost estimates only
    price_per_m_input_usd: 0.15,
    price_per_m_output_usd: 0.60,
    data_base_url: 'https://raw.githubusercontent.com/abhishek-patel-cadient/kesar-ai-copilot-assignment/refs/heads/main/data/',
  },
}];
