'use client';

import { TaskComponentProps } from './types';

export default function FormTask({ task, language, t }: TaskComponentProps) {
  const formPath = task.task_type.form_id
    ? `/form?lang=${language}`
    : null;

  return (
    <div className="space-y-4">
      {task.task_type.instructions && (
        <p className="text-sm text-[var(--ink)] leading-relaxed">{task.task_type.instructions}</p>
      )}

      {formPath ? (
        <a
          href={formPath}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-[var(--primary)] text-white py-3 px-4 rounded-none font-medium text-sm text-center hover:bg-[var(--primary-light)] transition-colors duration-200"
        >
          {t.open_form}
        </a>
      ) : (
        <p className="text-sm text-[var(--muted)] italic">
          {task.task_type.instructions || t.open_form}
        </p>
      )}

      <p className="text-xs text-[var(--muted)]">
        {language === 'en'
          ? 'This task will be marked complete once your form submission is processed.'
          : language === 'es'
          ? 'Esta tarea se marcará como completada una vez que se procese su formulario.'
          : 'Esta tarefa será marcada como concluída após o processamento do seu formulário.'}
      </p>
    </div>
  );
}
