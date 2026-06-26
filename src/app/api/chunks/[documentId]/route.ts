import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const maxDuration = 60; // Prevent 504 Vercel timeout errors

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> | { documentId: string } }
) {
  try {
    // Await params to support Next.js 15+ routing API
    const { documentId } = await params;
    
    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .order('id', { ascending: true }); 

    if (error) {
      console.error("Supabase fetch error:", error);
      throw new Error(`Failed to fetch chunks: ${error.message}`);
    }

    return NextResponse.json({ success: true, chunks: data || [] });

  } catch (err: any) {
    console.error('Chunks fetch error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch document chunks.' }, { status: 500 });
  }
}
