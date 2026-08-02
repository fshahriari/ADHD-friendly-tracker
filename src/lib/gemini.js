// ── Resilient Gemini AI Gateway (Multi-endpoint Proxy & Direct API Fallback) ──
import { settingsDb } from './db';

const DEFAULT_PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL || '';
const DIRECT_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Call Gemini 1.5 Flash with resilient failover across primary proxy, backup proxy, and direct API key.
 */
export async function callGemini(userPrompt, systemPrompt, options = {}) {
  const settings = settingsDb.get();
  const primaryProxy = settings.geminiProxyUrl || DEFAULT_PROXY_URL;
  const backupProxy  = settings.backupGeminiProxyUrl || '';
  const directApiKey = settings.directGeminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '';

  const errors = [];

  const aiProvider   = settings.aiProvider || 'gemini';

  // 0. OpenAI Compatible Fallback
  if (aiProvider === 'openai') {
    try {
      return await callOpenAIApi(primaryProxy, directApiKey, userPrompt, systemPrompt, options);
    } catch (err) {
      throw new Error(`خطا در ارتباط با سرور OpenAI: ${err.message}`);
    }
  }

  // 1. Try Primary Proxy (Gemini)
  if (primaryProxy) {
    try {
      return await callWorkerProxy(primaryProxy, userPrompt, systemPrompt, options);
    } catch (err) {
      console.warn('[Gemini] Primary proxy failed:', err.message);
      errors.push(`پروکسی اصلی: ${err.message}`);
    }
  }

  // 2. Try Backup Proxy
  if (backupProxy) {
    try {
      return await callWorkerProxy(backupProxy, userPrompt, systemPrompt, options);
    } catch (err) {
      console.warn('[Gemini] Backup proxy failed:', err.message);
      errors.push(`پروکسی پشتیبان: ${err.message}`);
    }
  }

  // 3. Try Direct Gemini API (if key supplied)
  if (directApiKey) {
    try {
      return await callDirectGeminiApi(directApiKey, userPrompt, systemPrompt, options);
    } catch (err) {
      console.warn('[Gemini] Direct API key failed:', err.message);
      errors.push(`کلید مستقیم API: ${err.message}`);
    }
  }

  if (!primaryProxy && !backupProxy && !directApiKey) {
    throw new Error('هیچ سرور پروکسی یا کلید API برای هوش مصنوعی تنظیم نشده است. لطفاً در تنظیمات آدرس پروکسی را وارد کنید.');
  }

  throw new Error(`خطا در اتصال به تمام سرورهای هوش مصنوعی:\n${errors.join('\n')}`);
}

async function callWorkerProxy(baseUrl, userPrompt, systemPrompt, options) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const response = await fetch(`${cleanUrl}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt,
      userPrompt,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 2048,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'خطای ناشناخته');
    throw new Error(`${response.status} — ${errorText}`);
  }

  const data = await response.json();
  return data.text || '';
}

async function callDirectGeminiApi(apiKey, userPrompt, systemPrompt, options) {
  const payload = {
    system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2048,
    },
  };

  const response = await fetch(`${DIRECT_GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'خطای API مستقیم');
    throw new Error(`${response.status} — ${errorText}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAIApi(baseUrl, apiKey, userPrompt, systemPrompt, options) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const endpoint = cleanUrl.endsWith('/v1/chat/completions') ? cleanUrl : `${cleanUrl}/v1/chat/completions`;
  
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
    },
    body: JSON.stringify({
      model: settingsDb.get().openaiModel || 'gpt-4o-mini',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'خطای ناشناخته OpenAI');
    throw new Error(`${response.status} — ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── ADHD Coach Agent System Prompt ────────────────────────────────────────

export function buildCoachSystemPrompt(context = {}) {
  const { tasks = [], events = [], rules = [] } = context;
  const now = new Date();

  return `
You are an empathetic, encouraging, non-judgmental ADHD Coach and Productivity Assistant for university students.
Your goal is to parse the student's raw thoughts, voice inputs, or questions, and extract structured actions while offering warm ADHD-friendly encouragement.

CURRENT USER CONTEXT:
- Today's Gregorian Date: ${now.toISOString().split('T')[0]}
- Existing Incomplete Tasks (${tasks.length}): ${JSON.stringify(tasks.slice(0, 10).map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, category: t.category })))}
- Existing Calendar Events (${events.length}): ${JSON.stringify(events.slice(0, 10).map(e => ({ title: e.title, startDate: e.startDate })))}
- Active User Rules / Preferences: ${JSON.stringify(rules.map(r => r.rule))}

INSTRUCTIONS:
1. Parse the student's text carefully. Detect any mentioned tasks, assignments, exams, classes, or specific reminder preferences.
2. Apply user rules automatically (e.g. if rule says "remind 1 day before for assignments", include 1440 in reminder minutes).
3. OUTPUT FORMAT: Respond ONLY with a valid JSON object matching this schema (no markdown fences, no text outside JSON):

{
  "coachMessage": "پیام گرم و تشویق‌کننده به زبان فارسی (کوتاه، لحن صمیمی و بدون ایجاد حس گناه)",
  "proposedTasks": [
    {
      "title": "عنوان دقیق تکلیف یا کار",
      "description": "توضیحات کوتاه",
      "category": "exam | assignment | habit | personal | lecture",
      "priority": "high | medium | low",
      "estimatedMinutes": 25,
      "energyRequired": "high | medium | low",
      "dueDate": "YYYY-MM-DD"
    }
  ],
  "proposedEvents": [
    {
      "title": "عنوان رویداد یا کلاس",
      "startDate": "YYYY-MM-DDTHH:mm:ss",
      "category": "lecture | exam | personal",
      "reminders": [1440, 60, 15]
    }
  ],
  "newDetectedRule": "متن قانون جدیدی که کاربر به عنوان ترجیح همیشگی بیان کرده (یا null اگر نبود)"
}

RULES FOR DATES & REMINDERS:
- Resolve relative dates like "فردا" (tomorrow), "پس‌فردا" (day after tomorrow), "جمعه" to exact YYYY-MM-DD strings based on today (${now.toISOString().split('T')[0]}).
- Standard category mapping:
  - exam: آزمون, امتحان, کوییز
  - assignment: تکلیف, پروژه, تمرین
  - lecture: کلاس, جلسه, ویس, استاد
  - habit: عادت, ورزش, مطالعه
  - personal: شخصی, خرید, سایر
`;
}

export const BRAIN_DUMP_SYSTEM_PROMPT = `
You are an ADHD task organization assistant. Respond strictly with JSON array.
`;

export const TASK_DECOMPOSER_SYSTEM_PROMPT = `
You are an ADHD task decomposition specialist.
TASK: Decompose the given task into 3-5 micro-steps.
OUTPUT FORMAT: Respond with a valid JSON array only:
[
  {
    "title": "عنوان گام",
    "description": "توضیح گام",
    "estimatedMinutes": 10,
    "order": 1
  }
]
`;

export const AUTO_SCHEDULE_SYSTEM_PROMPT = `
You are an ADHD daily scheduler.
Respond with JSON array only:
[
  {
    "taskId": "task-uuid",
    "scheduledTime": "HH:MM"
  }
]
`;

/**
 * Call ADHD Coach AI with context
 */
export async function runADHDCoach(userInput, context = {}) {
  const systemPrompt = buildCoachSystemPrompt(context);
  const rawText = await callGemini(userInput, systemPrompt, { temperature: 0.6 });

  // Clean markdown fences if any
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('[runADHDCoach] JSON parse fallback', rawText);
    return {
      coachMessage: rawText,
      proposedTasks: [],
      proposedEvents: [],
      newDetectedRule: null,
    };
  }
}

/**
 * Auto-schedule day
 */
export async function autoScheduleDay(tasks, energyLevel) {
  const prompt = `Tasks to schedule: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, duration: t.estimatedMinutes, priority: t.priority })))}. User energy level: ${energyLevel}`;
  const rawText = await callGemini(prompt, AUTO_SCHEDULE_SYSTEM_PROMPT);
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Decompose task
 */
export async function decomposeTask(taskTitle, taskDescription = '') {
  const prompt = `Task: ${taskTitle}. Description: ${taskDescription}`;
  const rawText = await callGemini(prompt, TASK_DECOMPOSER_SYSTEM_PROMPT);
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}
