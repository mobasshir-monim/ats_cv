import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { extractText } from 'unpdf';
import Database from 'better-sqlite3';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

const app = express();
const PORT = 3000;

// Initialize Database with dynamic path
const DATABASE_PATH = process.env.DATABASE_PATH || 'ats.db';
const dbDir = path.dirname(DATABASE_PATH);
if (dbDir !== '.' && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(DATABASE_PATH);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    job_circular TEXT NOT NULL,
    cv_text TEXT NOT NULL,
    trx_id TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'Pending Verification',
    results TEXT
  )
`);

// Multer for file uploads (in memory)
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// API Routes
app.post('/api/submit', upload.single('cv'), async (req, res) => {
  try {
    const { email, job_circular, trx_id } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'CV PDF is required' });
    }

    if (!email || !trx_id) {
      return res.status(400).json({ error: 'Email and Transaction ID are required' });
    }

    // Check if TrxID already exists
    const existing = db.prepare('SELECT id FROM submissions WHERE trx_id = ?').get(trx_id);
    if (existing) {
      return res.status(400).json({ error: 'Transaction ID already exists' });
    }

    // Parse PDF
    let cv_text = '';
    try {
      const data = await extractText(new Uint8Array(file.buffer));
      cv_text = Array.isArray(data.text) ? data.text.join('\n') : data.text;
      
      if (!cv_text || cv_text.trim().length === 0) {
        return res.status(400).json({ error: 'No text found in PDF. Please ensure it is a text-based PDF, not a scanned image.' });
      }
    } catch (err: any) {
      console.error('PDF Parse Error:', err);
      return res.status(400).json({ error: `Failed to parse PDF: ${err.message || 'Unknown error'}. Please ensure it is a valid text-based PDF.` });
    }

    // Save to DB
    const stmt = db.prepare('INSERT INTO submissions (email, job_circular, cv_text, trx_id) VALUES (?, ?, ?, ?)');
    stmt.run(email, job_circular, cv_text, trx_id);

    res.json({ success: true, message: 'Submission received. Pending verification.' });
  } catch (error) {
    console.error('Submit Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/pending', (req, res) => {
  try {
    const pending = db.prepare('SELECT id, email, trx_id, status FROM submissions WHERE status = ?').all('Pending Verification');
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending submissions' });
  }
});

app.get('/api/admin/approved', (req, res) => {
  try {
    const approved = db.prepare('SELECT id, email, trx_id, status FROM submissions WHERE status != ?').all('Pending Verification');
    res.json(approved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch approved submissions' });
  }
});

app.post('/api/admin/verify', async (req, res) => {
  try {
    const { trx_id } = req.body;
    if (!trx_id) return res.status(400).json({ error: 'TrxID required' });

    // Get submission
    const submission = db.prepare('SELECT * FROM submissions WHERE trx_id = ?').get(trx_id) as any;
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.status === 'Verified') return res.status(400).json({ error: 'Already verified' });

    // Mark as processing
    db.prepare('UPDATE submissions SET status = ? WHERE trx_id = ?').run('Processing', trx_id);

    // Trigger ATS Pipeline asynchronously
    processATS(submission).catch(err => {
      console.error('ATS Processing Error:', err);
      db.prepare('UPDATE submissions SET status = ?, results = ? WHERE trx_id = ?').run(
        'Failed',
        JSON.stringify({ error: 'Failed during ATS processing' }),
        trx_id
      );
    });

    res.json({ success: true, message: 'Verified and processing started' });
  } catch (error) {
    console.error('Verify Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/results/:trxId', (req, res) => {
  try {
    const { trxId } = req.params;
    const submission = db.prepare('SELECT status, results FROM submissions WHERE trx_id = ?').get(trxId) as any;
    
    if (!submission) return res.status(404).json({ error: 'Transaction ID not found' });

    let parsedResults = null;
    if (submission.results) {
      try {
        parsedResults = JSON.parse(submission.results);
      } catch {
        parsedResults = { error: 'Stored analysis result is invalid JSON' };
      }
    }
    
    res.json({
      status: submission.status,
      results: parsedResults
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

function normalizeGeminiJson(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');
  return cleaned;
}

function validateATSResultShape(parsed: any) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Gemini returned a non-object result');
  }

  if (typeof parsed.atsMatchScore !== 'number' || Number.isNaN(parsed.atsMatchScore)) {
    throw new Error('Missing or invalid atsMatchScore');
  }

  if (typeof parsed.yearsOfExperience !== 'number' || Number.isNaN(parsed.yearsOfExperience)) {
    throw new Error('Missing or invalid yearsOfExperience');
  }

  if (!Array.isArray(parsed.knockoutCriteria)) {
    throw new Error('Missing or invalid knockoutCriteria');
  }

  for (const item of parsed.knockoutCriteria) {
    if (!item || typeof item !== 'object') throw new Error('Invalid knockoutCriteria item');
    if (typeof item.criterion !== 'string') throw new Error('Invalid knockoutCriteria.criterion');
    if (typeof item.status !== 'string') throw new Error('Invalid knockoutCriteria.status');
    if (typeof item.reason !== 'string') throw new Error('Invalid knockoutCriteria.reason');
  }

  // Validate sectionRewrites if present
  if (parsed.sectionRewrites) {
    if (typeof parsed.sectionRewrites !== 'object') {
      throw new Error('Invalid sectionRewrites - must be an object');
    }
    for (const [key, section] of Object.entries(parsed.sectionRewrites)) {
      if (!section || typeof section !== 'object') throw new Error(`Invalid sectionRewrites.${key}`);
      if (typeof (section as any).section !== 'string') throw new Error(`Invalid section name in ${key}`);
      if (!Array.isArray((section as any).rewrites)) throw new Error(`Invalid rewrites array in ${key}`);
      for (const rewrite of (section as any).rewrites) {
        if (typeof rewrite !== 'string') throw new Error(`Invalid rewrite in ${key}`);
      }
    }
  }
  
  // Backward compatibility: allow old rewrites format too
  if (parsed.rewrites) {
    if (!Array.isArray(parsed.rewrites) || parsed.rewrites.some((r: unknown) => typeof r !== 'string')) {
      throw new Error('Missing or invalid rewrites');
    }
  }

  // Optional: validate suggestedJobs if present (for CV analysis without job circular)
  if (parsed.suggestedJobs) {
    if (!Array.isArray(parsed.suggestedJobs)) {
      throw new Error('Invalid suggestedJobs - must be an array');
    }
    for (const job of parsed.suggestedJobs) {
      if (!job || typeof job !== 'object') throw new Error('Invalid suggestedJobs item');
      if (typeof job.jobTitle !== 'string') throw new Error('Invalid jobTitle in suggestedJobs');
      if (typeof job.description !== 'string') throw new Error('Invalid description in suggestedJobs');
      if (typeof job.seniority !== 'string') throw new Error('Invalid seniority in suggestedJobs');
    }
  }

  // Validate missingCVSections if present
  if (parsed.missingCVSections) {
    if (!Array.isArray(parsed.missingCVSections)) {
      throw new Error('Invalid missingCVSections - must be an array');
    }
    for (const section of parsed.missingCVSections) {
      if (typeof section !== 'string') {
        throw new Error('Invalid missingCVSections item - must be string');
      }
    }
  }

  return parsed;
}

async function generateATSWithFallback(ai: GoogleGenAI, prompt: string) {
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const models = [configuredModel, 'gemini-2.5-flash', 'gemini-2.0-flash'].filter((m): m is string => Boolean(m));

  let lastError: unknown = null;

  for (const model of models) {
    try {
      console.log(`Running ATS analysis with model: ${model}`);
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
    } catch (err) {
      lastError = err;
      console.error(`Model ${model} failed:`, err);
    }
  }

  throw new Error(`All configured Gemini models failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function processATS(submission: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const ai = new GoogleGenAI({ apiKey });

  let prompt: string;

  if (submission.job_circular && submission.job_circular.trim().length > 0) {
    // With job circular - existing logic
    prompt = `
    You are an expert, strict technical recruiter and ATS (Applicant Tracking System) parser.
    Evaluate the provided CV against the Job Circular.

    Job Circular:
    ${submission.job_circular}

    Candidate CV:
    ${submission.cv_text}

    Instructions:
    1. Calculate the candidate's total years of relevant experience.
    2. Identify 3-5 hard knockout criteria from the job circular (e.g., specific degree, mandatory skills, minimum experience).
    3. Evaluate if the candidate passes or fails each knockout criteria based strictly on the CV.
    4. Calculate an overall ATS Match Score (0-100) based on how well the CV matches the circular.
    5. Check if the CV contains the following standard sections: Summary/Introduction, Education, Experience, Extra Curricular Activities, Skills, Achievements, References. Identify any missing sections. If NONE of these sections are present, the CV is invalid.
    6. Generate section-specific "Done-For-You" rewrites. For each CV section that needs improvement, provide 1-2 rewritten bullet points that better match the job circular using strong action verbs and quantifiable metrics. Include these sections where applicable: Professional Summary, Skills, Experience, Education, Certifications.

    Return the result strictly as a JSON object with this structure:
    {
      "atsMatchScore": <number 0-100>,
      "yearsOfExperience": <number>,
      "knockoutCriteria": [
        {
          "criterion": "<criterion name>",
          "status": "Pass or Fail",
          "reason": "<brief reason>"
        }
      ],
      "missingCVSections": ["<section name>", "<section name>"],
      "sectionRewrites": {
        "professionalSummary": {
          "section": "Professional Summary",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        },
        "skills": {
          "section": "Skills",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        },
        "experience": {
          "section": "Experience",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        },
        "education": {
          "section": "Education",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        },
        "certifications": {
          "section": "Certifications",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        }
      }
    }
  `;
  } else {
    // Without job circular - analyze for job readiness and suggest jobs
    prompt = `
    You are an expert career coach and ATS (Applicant Tracking System) analyst.
    Analyze the provided CV to determine the candidate's job readiness and suggest suitable job roles.

    Candidate CV:
    ${submission.cv_text}

    Instructions:
    1. Calculate the candidate's total years of relevant experience.
    2. Identify 5 core strengths/skill areas from the CV (e.g., programming languages, frameworks, soft skills, certifications).
    3. Evaluate the candidate's readiness level (Junior/Mid-level/Senior) based on experience and skills. Score 0-100 representation of general "job readiness".
    4. Based on the skills and experience identified, suggest 3-5 suitable job roles/positions that would be a good fit.
    5. Check if the CV contains the following standard sections: Summary/Introduction, Education, Experience, Extra Curricular Activities, Skills, Achievements, References. Identify any missing sections. If NONE of these sections are present, the CV is invalid.
    6. Generate section-specific "Done-For-You" rewrites that enhance the CV's overall appeal. For each CV section, provide 1-2 rewritten bullet points highlighting achievements with strong action verbs and quantifiable metrics. Include these sections where applicable: Professional Summary, Skills, Experience, Education, Certifications.

    Return the result strictly as a JSON object with this structure:
    {
      "atsMatchScore": <number 0-100, representing overall job readiness>,
      "yearsOfExperience": <number>,
      "knockoutCriteria": [
        {
          "criterion": "<core strength/skill area>",
          "status": "Identified",
          "reason": "<brief description of this strength>"
        }
      ],
      "missingCVSections": ["<section name>", "<section name>"],
      "suggestedJobs": [
        {
          "jobTitle": "<job title>",
          "description": "<why this role fits the candidate>",
          "seniority": "<Junior/Mid-level/Senior>"
        }
      ],
      "sectionRewrites": {
        "professionalSummary": {
          "section": "Professional Summary",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        },
        "skills": {
          "section": "Skills",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        },
        "experience": {
          "section": "Experience",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        },
        "education": {
          "section": "Education",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        },
        "certifications": {
          "section": "Certifications",
          "rewrites": ["<rewritten bullet point 1>", "<rewritten bullet point 2>"]
        }
      }
    }
  `;
  }

  const response = await generateATSWithFallback(ai, prompt);

  const raw = typeof response.text === 'string' ? response.text : '';

  if (!raw) {
    throw new Error('Failed to generate results from AI');
  }

  const normalized = normalizeGeminiJson(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error(`Gemini returned non-JSON content: ${normalized.slice(0, 300)}`);
  }

  const validated = validateATSResultShape(parsed);
  
  // Update DB
  db.prepare('UPDATE submissions SET status = ?, results = ? WHERE trx_id = ?').run(
    'Verified',
    JSON.stringify(validated),
    submission.trx_id
  );
}

// Vite middleware setup
async function startServer() {
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`DATABASE_PATH: ${DATABASE_PATH}`);

  if (process.env.NODE_ENV !== 'production') {
    // Development mode: Use Vite dev server
    console.log('Starting in development mode with Vite HMR...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('✓ Vite middleware loaded');
  } else {
    // Production mode: Serve built frontend from dist directory
    console.log('Starting in production mode, serving built frontend...');
    const distPath = path.resolve(process.cwd(), 'dist');
    
    if (!fs.existsSync(distPath)) {
      console.warn(`⚠ Warning: dist directory not found at ${distPath}`);
      console.warn('Build the frontend with: npm run build');
    } else {
      console.log(`✓ Serving static files from: ${distPath}`);
    }
    
    // Serve static files (CSS, JS, images, etc.)
    app.use(express.static(distPath, {
      maxAge: '1d', // Cache static assets for 1 day
      etag: false,
    }));
    
    // SPA catch-all: Serve index.html for all non-API routes
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
      }
    });
  }

  // Global error handler (must be last)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ Server running on http://localhost:${PORT}`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  Frontend:       http://localhost:${PORT}`);
    console.log(`  API:            http://localhost:${PORT}/api/*`);
    console.log(`  Admin:          http://localhost:${PORT}`);
  });
}

startServer();
