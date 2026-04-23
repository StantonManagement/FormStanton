'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types/compliance';

export interface ProjectListItem extends Project {
  unit_count: number;
  completion_percent: number;
}

export interface UseProjectsReturn {
  projects: ProjectListItem[];
  loading: boolean;
  error: string | null;
  createProject: (data: { name: string; description?: string; deadline?: string; sequential?: boolean; parent_project_id?: string }) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
  refresh: () => void;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/projects');
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load projects');

      const raw: Project[] = json.data || [];

      // Fetch unit + completion stats for all projects in parallel
      const enriched = await Promise.all(
        raw.map(async (p) => {
          try {
            const unitsRes = await fetch(`/api/admin/projects/${p.id}/units`);
            const unitsJson = await unitsRes.json();
            const units = unitsJson.success ? (unitsJson.data || []) : [];
            const unitCount = units.length;

            let totalCompletions = 0;
            let doneCompletions = 0;
            for (const u of units) {
              const completions = u.task_completions || [];
              totalCompletions += completions.length;
              doneCompletions += completions.filter((c: any) => c.status === 'complete').length;
            }

            return {
              ...p,
              unit_count: unitCount,
              completion_percent: totalCompletions > 0 ? Math.round((doneCompletions / totalCompletions) * 100) : 0,
            };
          } catch {
            return { ...p, unit_count: 0, completion_percent: 0 };
          }
        })
      );

      setProjects(enriched);
    } catch (err: any) {
      console.error('Projects fetch error:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (data: {
    name: string;
    description?: string;
    deadline?: string;
    sequential?: boolean;
    parent_project_id?: string;
  }): Promise<Project | null> => {
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to create project');
      await fetchProjects();
      return json.data;
    } catch (err: any) {
      console.error('Project create error:', err);
      throw err;
    }
  }, [fetchProjects]);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to delete project');
    await fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, createProject, deleteProject, refresh: fetchProjects };
}
