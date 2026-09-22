// netlify/functions/gemini-chat.js
// این تابع روی سرورهای Netlify اجرا می‌شه، پیام کاربر رو می‌گیره،
// به Gemini API وصل می‌شه و جواب رو برمی‌گردونه.
// API key هیچ‌وقت توی کد فرانت‌اند دیده نمی‌شه، فقط اینجا (سمت سرور) استفاده می‌شه.

const SYSTEM_CONTEXT =
  "You are a friendly assistant embedded on Abolfazl Fatahi's personal portfolio site. " +
  "Abolfazl is a developer born in 2010, focused on AI + code, curious about technology and programming. " +
  "His links: LinkedIn (abolfazl-fatahi-ba9913435), GitHub (abolfazlfatahi), Instagram (abfory89), Telegram (abfory). " +
  "Projects section is coming soon. Answer visitor questions about him or the site briefly and warmly, " +
  "in the same language the visitor writes in. Keep answers short (2-4 sentences).";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY تنظیم نشده" }) };
  }

  let message, history;
  try {
    const parsed = JSON.parse(event.body || "{}");
    message = parsed.message;
    history = Array.isArray(parsed.history) ? parsed.history : [];
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "بدنه درخواست نامعتبره" }) };
  }

  if (!message || typeof message !== "string") {
    return { statusCode: 400, body: JSON.stringify({ error: "پیام خالیه" }) };
  }

  // history رو به فرمت Gemini تبدیل می‌کنیم: [{role:'user'|'model', parts:[{text}]}]
  const contents = history
    .filter((m) => m && m.role && m.content)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content).slice(0, 4000) }],
    }));
  contents.push({ role: "user", parts: [{ text: message.slice(0, 4000) }] });

  const MODEL = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_CONTEXT }] },
        contents,
        generationConfig: { maxOutputTokens: 300 },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data?.error?.message || "خطا از سمت Gemini" }),
      };
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "متاسفم، نتونستم جواب بدم.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
