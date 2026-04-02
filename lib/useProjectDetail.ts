'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  Project,
  ProjectTask,
  TaskType,
  ProjectUnit,
  ProjectStatus,
} from '@/types/compliance';

export interface ProjectDetail extends Project {
  tasks: ProjectTask[];
  unit_count: number;
}

export interface UseProjectDetailReturn {
  project: ProjectDetail | null;
  units: ProjectUnit[];
  loading: boolean;
  unitsLoading: boolean;
  error: string | null;
  updateProject: (data: Partial<{ name: string; description: string; deadline: string | null; sequential: boolean; status: ProjectStatus }>) => Promise<void>;
  addTask: (taskTypeId: string, orderIndex: number, required?: boolean) => Promise<void>;
  updateTask: (taskId: string, data: Partial<{ order_index: number; required: boolean }>) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
  activate: (units: { building: string; unit_number: string }[]) => Promise<{ units_activated: number; tasks_created: number }>;
  addUnits: (units: { building: string; unit_number: string }[]) => Promise<{ units_added: number; tasks_created: number }>;
  regenerateToken: (unitId: string) => Promise<void>;
  fetchUnits: () => Promise<void>;
  refresh: () => void;
}

export function useProjectDetail(projectId: string | null): UseProjectDetailReturn {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [units, setUnits] = useState<ProjectUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load project');
      setProject(json.data as ProjectDetail);
    } catch (err: any) {
      console.error('Project detail fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchUnits = useCallback(async () => {
    if (!projectId) return;
    setUnitsLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/units`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load units');
      setUnits(json.data || []);
    } catch (err: any) {
      console.error('Project units fetch error:', err);
    } finally {
      setUnitsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    if (project && project.status !== 'draft') {
      fetchUnits();
    }
  }, [project?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateProject = useCallback(async (data: Partial<{ name: string; description: string; deadline: string | null; sequential: boolean; status: ProjectStatus }>) => {
    if (!projectId) return;
    const res = await fetch(`/api/admin/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to update project');
    await fetchProject();
  }, [projectId, fetchProject]);

  const addTask = useCallback(async (taskTypeId: string, orderIndex: number, required = true) => {
    if (!projectId) return;
    const res = await fetch(`/api/admin/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_type_id: taskTypeId, order_index: orderIndex, required }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to add task');
    await fetchProject();
  }, [projectId, fetchProject]);

  const updateTask = useCallback(async (taskId: string, data: Partial<{ order_index: number; required: boolean }>) => {
    if (!projectId) return;
    const res = await fetch(`/api/admin/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to update task');
    await fetchProject();
  }, [projectId, fetchProject]);

  const removeTask = useCallback(async (taskId: string) => {
    if (!projectId) return;
    const res = await fetch(`/api/admin/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to remove task');
    await fetchProject();
  }, [projectId, fetchProject]);

  const activate = useCallback(async (unitList: { building: string; unit_number: string }[]) => {
    if (!projectId) throw new Error('No project');
    const res = await fetch(`/api/admin/projects/${projectId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ units: unitList }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to activate project');
    await fetchProject();
    await fetchUnits();
    return json.data as { units_activated: number; tasks_created: number };
  }, [projectId, fetchProject, fetchUnits]);

  const addUnits = useCallback(async (unitList: { building: string; unit_number: string }[]) => {
    if (!projectId) throw new Error('No project');
    const res = await fetch(`/api/admin/projects/${projectId}/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ units: unitList }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to add units');
    await fetchProject();
    await fetchUnits();
    return json.data as { units_added: number; tasks_created: number };
  }, [projectId, fetchProject, fetchUnits]);

  const regenerateToken = useCallback(async (unitId: string) => {
    if (!projectId) return;
    const res = await fetch(`/api/admin/projects/${projectId}/units/${unitId}/token`, {
      method: 'PATCH',
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to regenerate token');
    await fetchUnits();
  }, [projectId, fetchUnits]);

  return {
    project,
    units,
    loading,
    unitsLoading,
    error,
    updateProject,
    addTask,
    updateTask,
    removeTask,
    activate,
    addUnits,
    regenerateToken,
    fetchUnits,
    refresh: fetchProject,
  };
}
