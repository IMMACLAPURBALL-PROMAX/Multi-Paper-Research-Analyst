import Dexie, { type Table } from 'dexie';
import { DocumentSource } from '@/types';

export interface DBMessage {
  id: string;
  workspaceId: string;
  documentId: string | null; // null for main workspace chat, or paper ID for staged chat
  sender: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: Array<{ id: string; title: string }>;
}

class ResearchDatabase extends Dexie {
  sources!: Table<DocumentSource>;
  messages!: Table<DBMessage>;

  constructor() {
    super('ResearchDatabase');
    this.version(1).stores({
      sources: 'id, title, status, addedAt',
      messages: 'id, workspaceId, documentId, timestamp',
    });
  }
}

export const db = new ResearchDatabase();

// Helper functions for easy database access
export async function getSources(status?: 'staged' | 'promoted'): Promise<DocumentSource[]> {
  if (status) {
    const list = await db.sources.where('status').equals(status).toArray();
    return list.sort((a, b) => a.addedAt - b.addedAt);
  }
  const list = await db.sources.toArray();
  return list.sort((a, b) => a.addedAt - b.addedAt);
}

export async function addSource(source: DocumentSource): Promise<string> {
  await db.sources.put(source);
  return source.id;
}

export async function deleteSource(id: string): Promise<void> {
  await db.sources.delete(id);
  // Also delete associated staged messages if any
  await db.messages.where('documentId').equals(id).delete();
}

export async function promoteSource(id: string): Promise<void> {
  await db.sources.update(id, { status: 'promoted' });
}

export async function getMessages(workspaceId: string, documentId: string | null = null): Promise<DBMessage[]> {
  const list = await db.messages
    .where('workspaceId').equals(workspaceId)
    .and(msg => msg.documentId === documentId)
    .toArray();
  return list.sort((a, b) => a.timestamp - b.timestamp);
}

export async function addMessage(message: DBMessage): Promise<string> {
  await db.messages.put(message);
  return message.id;
}

export async function clearWorkspaceMessages(workspaceId: string): Promise<void> {
  await db.messages.where({ workspaceId }).delete();
}
