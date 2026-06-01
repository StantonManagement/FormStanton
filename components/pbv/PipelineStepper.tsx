'use client';

/**
 * components/pbv/PipelineStepper.tsx
 * Horizontal lifecycle stepper for the admin full-application detail page.
 * Visualizes where an application sits in its pipeline:
 *   Invited → Intake → Review → HACH → Signing → Move-in
 * Purely presentational — stages are derived in the page and passed in.
 */

export type StageState = 'done' | 'current' | 'upcoming';

export interface PipelineStage {
  key: string;
  label: string;
  state: StageState;
  date?: string | null;
}

interface PipelineStepperProps {
  stages: PipelineStage[];
  onStageClick?: (key: string) => void;
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function PipelineStepper({ stages, onStageClick }: PipelineStepperProps) {
  return (
    <ol className="flex items-start w-full" role="list" aria-label="Application pipeline">
      {stages.map((stage, i) => {
        const isDone = stage.state === 'done';
        const isCurrent = stage.state === 'current';
        const clickable = !!onStageClick;

        const circle =
          isDone
            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
            : isCurrent
              ? 'bg-white text-[var(--primary)] border-[var(--primary)] ring-2 ring-[var(--primary)] ring-offset-1'
              : 'bg-white text-[var(--muted)] border-[var(--border)]';

        const labelColor =
          isCurrent ? 'text-[var(--primary)] font-semibold'
            : isDone ? 'text-[var(--ink)]'
              : 'text-[var(--muted)]';

        return (
          <li key={stage.key} className="flex-1 flex flex-col items-center relative min-w-0">
            {/* connector spanning from the previous stage's circle center to this one's */}
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-3.5 h-0.5 z-0 ${isDone || isCurrent ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
                style={{ left: '-50%', width: '100%' }}
              />
            )}
            <button
              type="button"
              onClick={clickable ? () => onStageClick!(stage.key) : undefined}
              disabled={!clickable}
              className={`relative z-10 flex flex-col items-center gap-1 px-1 ${clickable ? 'cursor-pointer group' : 'cursor-default'}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className={`flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-semibold transition-colors ${circle} ${clickable ? 'group-hover:border-[var(--primary)]' : ''}`}>
                {isDone ? <CheckIcon /> : i + 1}
              </span>
              <span className={`text-[11px] leading-tight text-center whitespace-nowrap ${labelColor}`}>
                {stage.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
