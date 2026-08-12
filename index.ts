const { messages } = await req.json();
const lastUserMessage = messages.filter((m: any) => m.role === "user").pop()?.content || "";

// Sanitize the search term before using in DB queries
const sanitized = sanitizeSearchInput(lastUserMessage);

// Search DB for relevant results using service role
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const searchPattern = `%${sanitized}%`;

// Search locations
const { data: locations } = await supabase
  .from("locations")
  .select("id, name, business_type, sub_category, address, lat, lng, phone, rating, review_count, price_from, currency, description")
  .or(`name.ilike.${searchPattern},address.ilike.${searchPattern},sub_category.ilike.${searchPattern},business_type.ilike.${searchPattern},description.ilike.${searchPattern}`)
  .limit(10);

// Search services
const { data: services } = await supabase
  .from("services")
  .select("id, name, price, currency, duration_minutes, location_id, description")
  .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
  .limit(10);

// Build context for the LLM
const searchContext = {
  locations: locations || [],
  services: services || [],
  categories: categories || [],
};

// Call the LLM with the retrieved context (RAG-style pipeline)
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: true,
  }),
});
