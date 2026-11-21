import {
  isWasteCategory,
  type Question,
  type QuestionType,
  type WasteCategory,
} from '../types/game';

export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  format: 'json' | 'csv' | 'unknown';
  totalRows: number;
  questions: Question[];
  errors: ImportRowError[];
}

const VALID_TYPES: QuestionType[] = [
  'multiple-choice',
  'which-bin',
  'true-false',
  'discussion',
];

function validateQuestionObject(
  raw: Record<string, unknown>,
  rowIndex: number
): { question?: Question; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const row = rowIndex + 1;

  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `q${String(row).padStart(2, '0')}`;

  const rawType = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : '';
  const type = VALID_TYPES.includes(rawType as QuestionType)
    ? (rawType as QuestionType)
    : null;
  if (!type) {
    errors.push({
      row,
      field: 'type',
      message: `Invalid type "${String(raw.type ?? '')}". Use: multiple-choice, which-bin, true-false, or discussion.`,
    });
  }

  const rawCategory =
    typeof raw.category === 'string' ? raw.category.trim().toLowerCase() : '';
  const category: WasteCategory | null = isWasteCategory(rawCategory)
    ? rawCategory
    : null;
  if (!category) {
    errors.push({
      row,
      field: 'category',
      message: `Invalid category "${String(raw.category ?? '')}". Use: bio, paper, cardboard, plastic, glass, metal, mixed, hazard, or reuse.`,
    });
  }

  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  if (!prompt) {
    errors.push({
      row,
      field: 'prompt',
      message: 'Missing required "prompt" text.',
    });
  }

  let options: string[] = [];
  if (Array.isArray(raw.options)) {
    options = raw.options.map((o) => String(o).trim()).filter(Boolean);
  } else if (typeof raw.options === 'string') {
    options = raw.options
      .split('|')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  let optionsFi: string[] | undefined;
  if (Array.isArray(raw.optionsFi)) {
    const parsedFi = raw.optionsFi.map((o) => String(o).trim());
    if (parsedFi.some(Boolean)) optionsFi = parsedFi;
  } else if (typeof raw.optionsFi === 'string' && raw.optionsFi.trim()) {
    optionsFi = raw.optionsFi.split('|').map((o) => o.trim());
  }

  if (type && type !== 'discussion') {
    if (options.length < 2 || options.length > 4) {
      errors.push({
        row,
        field: 'options',
        message: `Expected 2–4 options (found ${options.length}). In CSV, separate options with "|".`,
      });
    }
    if (type === 'true-false' && options.length !== 2) {
      errors.push({
        row,
        field: 'options',
        message: 'true-false questions must have exactly 2 options.',
      });
    }
  }

  let answer: number | undefined;
  if (type && type !== 'discussion') {
    const rawAns = raw.answer;
    if (rawAns === undefined || rawAns === null || rawAns === '') {
      errors.push({
        row,
        field: 'answer',
        message: 'Missing required "answer" index (0-based).',
      });
    } else {
      const parsed = Number(rawAns);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed >= options.length) {
        errors.push({
          row,
          field: 'answer',
          message: `Answer index "${String(rawAns)}" is out of range for ${options.length} options (use 0–${Math.max(0, options.length - 1)}).`,
        });
      } else {
        answer = parsed;
      }
    }
  }

  const explanation =
    typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  const explanationFi =
    typeof raw.explanationFi === 'string' && raw.explanationFi.trim()
      ? raw.explanationFi.trim()
      : undefined;
  const promptFi =
    typeof raw.promptFi === 'string' && raw.promptFi.trim()
      ? raw.promptFi.trim()
      : undefined;
  const image = typeof raw.image === 'string' ? raw.image.trim() : '';
  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : undefined;

  if (errors.length > 0 || !type || !category) {
    return { errors };
  }

  return {
    errors: [],
    question: {
      id,
      type,
      category,
      prompt,
      promptFi,
      image,
      options,
      optionsFi,
      answer,
      explanation,
      explanationFi,
      notes,
    },
  };
}

/**
 * RFC 4180-compatible CSV parser supporting quoted fields, embedded commas,
 * escaped quotes (""), and LF/CRLF line endings.
 */
function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

export function parseQuestionsInput(rawInput: string): ImportResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      format: 'unknown',
      totalRows: 0,
      questions: [],
      errors: [{ row: 1, message: 'Input is empty. Paste JSON or CSV questions.' }],
    };
  }

  // Try JSON if starts with [ or {
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === 'object' &&
            'questions' in parsed &&
            Array.isArray((parsed as { questions: unknown }).questions)
          ? (parsed as { questions: unknown[] }).questions
          : null;

      if (!list) {
        return {
          format: 'json',
          totalRows: 0,
          questions: [],
          errors: [
            {
              row: 1,
              message: 'JSON must be an array of question objects (or { "questions": [...] }).',
            },
          ],
        };
      }

      const questions: Question[] = [];
      const errors: ImportRowError[] = [];
      const seenIds = new Set<string>();

      list.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push({
            row: index + 1,
            message: 'Entry is not a valid JSON object.',
          });
          return;
        }
        const validated = validateQuestionObject(
          item as Record<string, unknown>,
          index
        );
        errors.push(...validated.errors);
        if (validated.question) {
          let finalId = validated.question.id;
          while (seenIds.has(finalId)) {
            finalId = `${finalId}_${index + 1}`;
          }
          seenIds.add(finalId);
          questions.push({ ...validated.question, id: finalId });
        }
      });

      return {
        format: 'json',
        totalRows: list.length,
        questions,
        errors,
      };
    } catch (err) {
      return {
        format: 'json',
        totalRows: 0,
        questions: [],
        errors: [
          {
            row: 1,
            message: `Invalid JSON syntax: ${err instanceof Error ? err.message : 'Unable to parse.'}`,
          },
        ],
      };
    }
  }

  // Parse CSV
  const matrix = parseCsvMatrix(trimmed);
  if (matrix.length < 2) {
    return {
      format: 'csv',
      totalRows: 0,
      questions: [],
      errors: [
        {
          row: 1,
          message:
            'CSV needs a header row (e.g. id,type,category,prompt,options,answer,explanation) plus at least one question row.',
        },
      ],
    };
  }

  const headers = matrix[0].map((h) => h.trim());
  const dataRows = matrix.slice(1);
  const questions: Question[] = [];
  const errors: ImportRowError[] = [];
  const seenIds = new Set<string>();

  dataRows.forEach((cells, index) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, colIdx) => {
      if (header) {
        obj[header] = cells[colIdx] ?? '';
      }
    });

    const validated = validateQuestionObject(obj, index + 1);
    errors.push(...validated.errors);
    if (validated.question) {
      let finalId = validated.question.id;
      while (seenIds.has(finalId)) {
        finalId = `${finalId}_${index + 1}`;
      }
      seenIds.add(finalId);
      questions.push({ ...validated.question, id: finalId });
    }
  });

  return {
    format: 'csv',
    totalRows: dataRows.length,
    questions,
    errors,
  };
}
