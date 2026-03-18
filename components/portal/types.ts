import { PreferredLanguage } from '@/types/compliance';
import { PortalStrings } from '@/lib/portalTranslations';

export interface PortalTask {
  id: string;
  order_index: number;
  required: boolean;
  task_type: {
    id: string;
    name: string;
    description: string | null;
    assignee: string;
    evidence_type: string;
    form_id: string | null;
    instructions: string | null;
  };
  completion: {
    status: string;
    evidence_url: string | null;
    completed_at: string | null;
    notes: string | null;
  };
}

export interface TaskComponentProps {
  task: PortalTask;
  token: string;
  language: PreferredLanguage;
  t: PortalStrings;
  onComplete: () => void;
}
