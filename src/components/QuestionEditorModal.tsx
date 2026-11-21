import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  formatCategoryLabel,
  WASTE_CATEGORY_LIST,
  type Question,
  type QuestionType,
  type WasteCategory,
} from '../types/game';
import { Button } from './ui/Button';

interface QuestionEditorModalProps {
  open: boolean;
  initialQuestion: Question | null;
  nextIdSuggestion: string;
  onSave: (question: Question) => void;
  onClose: () => void;
}

const QUESTION_TYPES: { id: QuestionType; label: string }[] = [
  { id: 'which-bin', label: 'Which bin?' },
  { id: 'multiple-choice', label: 'Multiple choice' },
  { id: 'true-false', label: 'True / False' },
  { id: 'discussion', label: 'Open discussion' },
];

export function QuestionEditorModal({
  open,
  initialQuestion,
  nextIdSuggestion,
  onSave,
  onClose,
}: QuestionEditorModalProps) {
  const [type, setType] = useState<QuestionType>('which-bin');
  const [category, setCategory] = useState<WasteCategory>('bio');
  const [prompt, setPrompt] = useState('');
  const [promptFi, setPromptFi] = useState('');
  const [image, setImage] = useState('');
  const [options, setOptions] = useState<string[]>([
    'cardboard',
    'bio',
    'mixed',
    'paper',
  ]);
  const [optionsFi, setOptionsFi] = useState<string[]>(['', '', '', '']);
  const [answer, setAnswer] = useState<number>(0);
  const [explanation, setExplanation] = useState('');
  const [explanationFi, setExplanationFi] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialQuestion) {
      setType(initialQuestion.type);
      setCategory(initialQuestion.category);
      setPrompt(initialQuestion.prompt);
      setPromptFi(initialQuestion.promptFi ?? '');
      setImage(initialQuestion.image ?? '');
      setOptions([...initialQuestion.options]);
      setOptionsFi(
        initialQuestion.options.map((_, i) => initialQuestion.optionsFi?.[i] ?? '')
      );
      setAnswer(initialQuestion.answer ?? 0);
      setExplanation(initialQuestion.explanation);
      setExplanationFi(initialQuestion.explanationFi ?? '');
      setNotes(initialQuestion.notes ?? '');
    } else {
      setType('which-bin');
      setCategory('bio');
      setPrompt('');
      setPromptFi('');
      setImage('');
      setOptions(['cardboard', 'bio', 'mixed', 'paper']);
      setOptionsFi(['', '', '', '']);
      setAnswer(1);
      setExplanation('');
      setExplanationFi('');
      setNotes('');
    }
  }, [open, initialQuestion]);

  if (!open) return null;

  const handleTypeChange = (nextType: QuestionType) => {
    setType(nextType);
    setError(null);
    if (nextType === 'true-false') {
      setOptions(['True', 'False']);
      setOptionsFi(['Totta', 'Tarua']);
      setAnswer(0);
    } else if (nextType === 'which-bin') {
      setOptions(['cardboard', 'bio', 'mixed', 'plastic']);
      setOptionsFi(['', '', '', '']);
      setAnswer(1);
    } else if (nextType === 'discussion') {
      setOptions([]);
      setOptionsFi([]);
    } else {
      setOptions(options.length >= 2 ? options.slice(0, 4) : ['', '', '', '']);
      setOptionsFi(
        options.length >= 2 ? optionsFi.slice(0, 4) : ['', '', '', '']
      );
      setAnswer(0);
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  };

  const handleOptionFiChange = (idx: number, val: string) => {
    setOptionsFi((prev) => prev.map((o, i) => (i === idx ? val : o)));
  };

  const handleAddOption = () => {
    if (options.length >= 4) return;
    setOptions((prev) => [
      ...prev,
      type === 'which-bin' ? 'glass' : '',
    ]);
    setOptionsFi((prev) => [...prev, '']);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
    setOptionsFi((prev) => prev.filter((_, i) => i !== idx));
    if (answer >= options.length - 1) {
      setAnswer(Math.max(0, options.length - 2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Enter a question prompt in English.');
      return;
    }

    if (type !== 'discussion') {
      const cleaned = options.map((o) => o.trim());
      if (cleaned.length < 2 || cleaned.some((o) => !o)) {
        setError('Fill in all answer options (2–4 options).');
        return;
      }
      if (answer < 0 || answer >= cleaned.length) {
        setError('Pick which option is the correct answer.');
        return;
      }
    }

    const cleanedOptions =
      type === 'discussion' ? [] : options.map((o) => o.trim());
    const cleanedOptionsFi =
      type === 'discussion' || type === 'which-bin'
        ? undefined
        : optionsFi.some((o) => o.trim())
          ? optionsFi.map((o) => o.trim())
          : undefined;

    onSave({
      id: initialQuestion?.id ?? nextIdSuggestion,
      type,
      category,
      prompt: prompt.trim(),
      promptFi: promptFi.trim() || undefined,
      image: image.trim(),
      options: cleanedOptions,
      optionsFi: cleanedOptionsFi,
      answer: type === 'discussion' ? undefined : answer,
      explanation: explanation.trim(),
      explanationFi: explanationFi.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#08090A]/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-editor-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[12px] bg-[#111214] border border-[#23252A] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#23252A] flex items-center justify-between">
          <h2
            id="question-editor-title"
            className="text-[16px] font-semibold text-[#F7F8F8]"
          >
            {initialQuestion
              ? `Edit Question (${initialQuestion.id})`
              : 'Add Question'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close question editor"
            className="h-8 w-8 inline-flex items-center justify-center rounded-[6px] text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#18191C] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="question-editor-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* Type & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#8A8F98] mb-1.5">
                Question type
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-[8px] bg-[#08090A] border border-[#23252A]">
                {QUESTION_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeChange(t.id)}
                    className={`h-8 px-2 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      type === t.id
                        ? 'bg-[#18191C] text-[#F7F8F8] border border-[#23252A]'
                        : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="q-category"
                className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
              >
                Waste stream category
              </label>
              <select
                id="q-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as WasteCategory)}
                className="w-full h-10 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[13px] text-[#F7F8F8]"
              >
                {WASTE_CATEGORY_LIST.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatCategoryLabel(cat, 'bilingual')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bilingual Prompt */}
          <div className="space-y-3">
            <div>
              <label
                htmlFor="q-prompt-en"
                className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
              >
                Question prompt (English)
              </label>
              <textarea
                id="q-prompt-en"
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A greasy pizza box from the cookout. Which bin?"
                className="w-full p-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[14px] text-[#F7F8F8] placeholder:text-[#5C616B]"
              />
            </div>

            <div>
              <label
                htmlFor="q-prompt-fi"
                className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
              >
                Question prompt (Finnish · optional)
              </label>
              <textarea
                id="q-prompt-fi"
                rows={2}
                value={promptFi}
                onChange={(e) => setPromptFi(e.target.value)}
                placeholder="esim. Rasvainen pizzalaatikko grillijuhlista. Minne kuuluu?"
                className="w-full p-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[13px] text-[#F7F8F8] placeholder:text-[#5C616B]"
              />
            </div>
          </div>

          {/* Options (hidden for discussion) */}
          {type !== 'discussion' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-[#8A8F98]">
                  Options (select the correct answer)
                </label>
                {type !== 'true-false' && options.length < 4 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1 text-[12px] text-[#C8F560] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add option
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-[8px] bg-[#08090A] border border-[#23252A] p-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => setAnswer(idx)}
                      title="Mark as correct answer"
                      className={`mt-1 w-7 h-7 rounded-[6px] font-mono text-[12px] font-semibold border shrink-0 transition-colors cursor-pointer ${
                        answer === idx
                          ? 'bg-[#4CC38A] border-[#4CC38A] text-[#08090A]'
                          : 'bg-[#111214] border-[#23252A] text-[#8A8F98] hover:text-[#F7F8F8]'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </button>

                    {type === 'which-bin' ? (
                      <select
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        className="flex-1 h-9 px-3 rounded-[6px] bg-[#111214] border border-[#23252A] text-[13px] text-[#F7F8F8]"
                      >
                        {WASTE_CATEGORY_LIST.map((cat) => (
                          <option key={cat} value={cat}>
                            {formatCategoryLabel(cat, 'bilingual')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            handleOptionChange(idx, e.target.value)
                          }
                          placeholder={`Option ${String.fromCharCode(65 + idx)} (EN)`}
                          className="h-9 px-3 rounded-[6px] bg-[#111214] border border-[#23252A] text-[13px] text-[#F7F8F8] placeholder:text-[#5C616B]"
                        />
                        <input
                          type="text"
                          value={optionsFi[idx] ?? ''}
                          onChange={(e) =>
                            handleOptionFiChange(idx, e.target.value)
                          }
                          placeholder={`Option ${String.fromCharCode(65 + idx)} (FI · optional)`}
                          className="h-9 px-3 rounded-[6px] bg-[#111214] border border-[#23252A] text-[13px] text-[#F7F8F8] placeholder:text-[#5C616B]"
                        />
                      </div>
                    )}

                    {type !== 'true-false' && options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        aria-label={`Remove option ${String.fromCharCode(65 + idx)}`}
                        className="mt-1 h-7 w-7 inline-flex items-center justify-center rounded-[6px] text-[#8A8F98] hover:text-[#F2555A] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#5C616B]">
                Green letter badge marks the correct answer revealed on Stage.
              </p>
            </div>
          ) : (
            <div className="rounded-[8px] bg-[#08090A] border border-[#23252A] px-3.5 py-3 text-[12px] text-[#8A8F98]">
              Open discussion questions have no right or wrong answer. Pressing{' '}
              <span className="text-[#F7F8F8] font-medium">Reveal</span> displays
              the talking point or fun fact below on Stage.
            </div>
          )}

          {/* Explanation / Talking point */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="q-expl-en"
                className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
              >
                {type === 'discussion'
                  ? 'Talking point / fun fact (EN)'
                  : 'Explanation shown on reveal (EN)'}
              </label>
              <textarea
                id="q-expl-en"
                rows={3}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Warm, short takeaway shown after Reveal..."
                className="w-full p-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[13px] text-[#F7F8F8] placeholder:text-[#5C616B]"
              />
            </div>

            <div>
              <label
                htmlFor="q-expl-fi"
                className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
              >
                {type === 'discussion'
                  ? 'Talking point (FI · optional)'
                  : 'Explanation (FI · optional)'}
              </label>
              <textarea
                id="q-expl-fi"
                rows={3}
                value={explanationFi}
                onChange={(e) => setExplanationFi(e.target.value)}
                placeholder="Lyhyt suomenkielinen selitys..."
                className="w-full p-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[13px] text-[#F7F8F8] placeholder:text-[#5C616B]"
              />
            </div>
          </div>

          {/* Presenter Notes (Host-only) & Optional Image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="q-notes"
                className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
              >
                Presenter notes (Host only, never on Stage)
              </label>
              <input
                id="q-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Ask the crowd before revealing!"
                className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[13px] text-[#F7F8F8] placeholder:text-[#5C616B]"
              />
            </div>
            <div>
              <label
                htmlFor="q-image"
                className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
              >
                Image path / URL (optional)
              </label>
              <input
                id="q-image"
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="Optional local image path"
                className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[13px] text-[#F7F8F8] placeholder:text-[#5C616B]"
              />
            </div>
          </div>

          {error && <p className="text-[12px] text-[#F2555A]">{error}</p>}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#23252A] flex items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="question-editor-form" variant="primary">
            {initialQuestion ? 'Save Changes' : 'Add Question'}
          </Button>
        </div>
      </div>
    </div>
  );
}
