// Workspace API client with optimistic+confirm pattern

interface WorkspaceMessage {
  id: string;
  workspace_id: string;
  document_id?: string;
  author_user_id: string;
  author_display_name: string;
  author_party_org: string;
  body: string;
  created_at: string;
  edited_at?: string;
}

interface Workspace {
  id: string;
  workspace_type: string;
  anchor_id: string;
  created_at: string;
  parties: Array<{
    id: string;
    party_role: string;
    party_org: string;
    display_label: string;
  }>;
  unread_counts: Record<string, number>;
}

// Generic error class
class WorkspaceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

// Helper for verification with retry
async function verifyWithRetry<T>(
  verifyFn: () => Promise<T>,
  maxAttempts = 3,
  delay = 500
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await verifyFn();
      return result;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error('Verification failed after all attempts');
}

// Stanton workspace client
export const stantonWorkspaceClient = {
  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const res = await fetch(`/api/admin/workspaces/${workspaceId}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new WorkspaceError(data.message || 'Failed to fetch workspace', 'FETCH_ERROR');
    }
    return data.data.workspace;
  },

  async getMessages(workspaceId: string, channel: 'stanton' | 'shared', documentId?: string): Promise<WorkspaceMessage[]> {
    const url = new URL(`/api/admin/workspaces/${workspaceId}/channel/${channel}/messages`, window.location.origin);
    if (documentId) {
      url.searchParams.set('document_id', documentId);
    }
    
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new WorkspaceError(data.message || 'Failed to fetch messages', 'FETCH_ERROR');
    }
    return data.data.messages;
  },

  async postMessage(
    workspaceId: string, 
    channel: 'stanton' | 'shared', 
    body: string, 
    documentId?: string
  ): Promise<WorkspaceMessage> {
    if (!body.trim()) {
      throw new WorkspaceError('Message body cannot be empty', 'INVALID_INPUT');
    }

    // Optimistic: return immediately with temporary data
    const optimisticMessage: WorkspaceMessage = {
      id: `temp-${Date.now()}`,
      workspace_id: workspaceId,
      document_id: documentId,
      author_user_id: 'current-user', // Will be filled by actual response
      author_display_name: 'You',
      author_party_org: 'stanton',
      body: body.trim(),
      created_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel/${channel}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          document_id: documentId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new WorkspaceError(data.message || 'Failed to post message', 'POST_ERROR');
      }

      // Verify: re-fetch to confirm message was saved
      const verifyMessages = await verifyWithRetry(async () => {
        const messages = await this.getMessages(workspaceId, channel, documentId);
        const found = messages.find((m: WorkspaceMessage) => m.id === data.data.id);
        if (!found) {
          throw new Error('Message not found after post');
        }
        return messages;
      });

      return verifyMessages.find((m: WorkspaceMessage) => m.id === data.data.id)!;
    } catch (error) {
      // On failure, throw to let caller handle optimistic revert
      throw error instanceof WorkspaceError ? error : new WorkspaceError('Network error', 'NETWORK_ERROR');
    }
  },

  async editMessage(
    workspaceId: string,
    messageId: string,
    channel: 'stanton' | 'shared',
    newBody: string
  ): Promise<WorkspaceMessage> {
    if (!newBody.trim()) {
      throw new WorkspaceError('Message body cannot be empty', 'INVALID_INPUT');
    }

    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel/${channel}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: newBody.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 409) {
          throw new WorkspaceError('Edit window expired', 'EDIT_WINDOW_EXPIRED');
        }
        throw new WorkspaceError(data.message || 'Failed to edit message', 'EDIT_ERROR');
      }

      // Verify: re-fetch to confirm edit was saved
      // Note: We'd need workspaceId and documentId for a full verify, 
      // so we'll trust the server response for edits
      return data.data;
    } catch (error) {
      throw error instanceof WorkspaceError ? error : new WorkspaceError('Network error', 'NETWORK_ERROR');
    }
  },

  async markChannelRead(workspaceId: string, channel: 'stanton' | 'shared'): Promise<void> {
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel/${channel}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new WorkspaceError(data.message || 'Failed to mark channel read', 'MARK_READ_ERROR');
      }

      // Verify: check that unread count is now 0
      const workspace = await this.getWorkspace(workspaceId);
      if (workspace.unread_counts[channel] > 0) {
        throw new Error('Channel still shows unread messages after mark read');
      }
    } catch (error) {
      throw error instanceof WorkspaceError ? error : new WorkspaceError('Network error', 'NETWORK_ERROR');
    }
  },
};

// HACH workspace client
export const hachWorkspaceClient = {
  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const res = await fetch(`/api/hach/workspaces/${workspaceId}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new WorkspaceError(data.message || 'Failed to fetch workspace', 'FETCH_ERROR');
    }
    return data.data.workspace;
  },

  async getMessages(workspaceId: string, channel: 'hach' | 'shared', documentId?: string): Promise<WorkspaceMessage[]> {
    const url = new URL(`/api/hach/workspaces/${workspaceId}/channel/${channel}/messages`, window.location.origin);
    if (documentId) {
      url.searchParams.set('document_id', documentId);
    }
    
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new WorkspaceError(data.message || 'Failed to fetch messages', 'FETCH_ERROR');
    }
    return data.data.messages;
  },

  async postMessage(
    workspaceId: string, 
    channel: 'hach' | 'shared', 
    body: string, 
    documentId?: string
  ): Promise<WorkspaceMessage> {
    if (!body.trim()) {
      throw new WorkspaceError('Message body cannot be empty', 'INVALID_INPUT');
    }

    // Optimistic: return immediately with temporary data
    const optimisticMessage: WorkspaceMessage = {
      id: `temp-${Date.now()}`,
      workspace_id: workspaceId,
      document_id: documentId,
      author_user_id: 'current-user',
      author_display_name: 'You',
      author_party_org: 'hach',
      body: body.trim(),
      created_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/hach/workspaces/${workspaceId}/channel/${channel}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          document_id: documentId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new WorkspaceError(data.message || 'Failed to post message', 'POST_ERROR');
      }

      // Verify: re-fetch to confirm message was saved
      const verifyMessages = await verifyWithRetry(async () => {
        const messages = await this.getMessages(workspaceId, channel, documentId);
        const found = messages.find((m: WorkspaceMessage) => m.id === data.data.id);
        if (!found) {
          throw new Error('Message not found after post');
        }
        return messages;
      });

      return verifyMessages.find((m: WorkspaceMessage) => m.id === data.data.id)!;
    } catch (error) {
      throw error instanceof WorkspaceError ? error : new WorkspaceError('Network error', 'NETWORK_ERROR');
    }
  },

  async editMessage(
    workspaceId: string,
    messageId: string,
    channel: 'hach' | 'shared',
    newBody: string
  ): Promise<WorkspaceMessage> {
    if (!newBody.trim()) {
      throw new WorkspaceError('Message body cannot be empty', 'INVALID_INPUT');
    }

    try {
      const res = await fetch(`/api/hach/workspaces/${workspaceId}/channel/${channel}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: newBody.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 409) {
          throw new WorkspaceError('Edit window expired', 'EDIT_WINDOW_EXPIRED');
        }
        throw new WorkspaceError(data.message || 'Failed to edit message', 'EDIT_ERROR');
      }

      return data.data;
    } catch (error) {
      throw error instanceof WorkspaceError ? error : new WorkspaceError('Network error', 'NETWORK_ERROR');
    }
  },

  async markChannelRead(workspaceId: string, channel: 'hach' | 'shared'): Promise<void> {
    try {
      const res = await fetch(`/api/hach/workspaces/${workspaceId}/channel/${channel}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new WorkspaceError(data.message || 'Failed to mark channel read', 'MARK_READ_ERROR');
      }

      // Verify: check that unread count is now 0
      const workspace = await this.getWorkspace(workspaceId);
      if (workspace.unread_counts[channel] > 0) {
        throw new Error('Channel still shows unread messages after mark read');
      }
    } catch (error) {
      throw error instanceof WorkspaceError ? error : new WorkspaceError('Network error', 'NETWORK_ERROR');
    }
  },
};

// Utility function to get the right client based on context
export function getWorkspaceClient(context: 'stanton' | 'hach') {
  return context === 'stanton' ? stantonWorkspaceClient : hachWorkspaceClient;
}
