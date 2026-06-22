import { NextResponse } from 'next/server';
import { DocumentSource, PaperMetadata } from '@/types';

// Helper to clean up strings (remove HTML tags, excessive spaces, newlines)
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // strip HTML
    .replace(/\s+/g, ' ')    // collapse whitespaces
    .trim();
}

// Regex XML parser for arXiv response
function parseArxivXml(xmlText: string): DocumentSource[] {
  const papers: DocumentSource[] = [];
  // Split into entry chunks
  const entryMatches = xmlText.match(/<entry>([\s\S]*?)<\/entry>/g);
  
  if (!entryMatches) return [];

  for (const entry of entryMatches) {
    try {
      // Extract title
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const title = cleanText(titleMatch ? titleMatch[1] : 'Untitled arXiv Paper');

      // Extract abstract/summary
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const abstract = cleanText(summaryMatch ? summaryMatch[1] : '');

      // Extract arXiv ID and PDF URL
      const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
      const idUrl = idMatch ? idMatch[1].trim() : '';
      const arxivId = idUrl.split('/abs/').pop()?.split('v')[0] || idUrl.split('/').pop() || Math.random().toString(36).substring(7);
      
      // Extract authors
      const authorMatches = entry.match(/<author>([\s\S]*?)<\/author>/g) || [];
      const authors: string[] = [];
      for (const authorXml of authorMatches) {
        const nameMatch = authorXml.match(/<name>([\s\S]*?)<\/name>/);
        if (nameMatch) {
          authors.push(cleanText(nameMatch[1]));
        }
      }

      // Extract publication date
      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
      const publishedDate = publishedMatch ? publishedMatch[1].substring(0, 10) : '';
      const publishedYear = publishedDate ? parseInt(publishedDate.substring(0, 4), 10) : undefined;

      // Extract PDF link
      let pdfUrl = '';
      const linkMatches = entry.match(/<link[^>]*href="([^"]*)"[^>]*title="pdf"[^>]*\/>/) || 
                          entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]*)"[^>]*\/>/);
      if (linkMatches) {
        pdfUrl = linkMatches[1];
      } else {
        // Fallback PDF guessing from idUrl
        pdfUrl = idUrl.replace('/abs/', '/pdf/') + '.pdf';
      }

      // Extract DOI if available
      const doiMatch = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/) || 
                       entry.match(/<doi[^>]*>([\s\S]*?)<\/doi>/);
      const doi = doiMatch ? cleanText(doiMatch[1]) : undefined;

      const metadata: PaperMetadata = {
        arXivId: arxivId,
        url: idUrl,
        pdfUrl,
        publicationDate: publishedDate,
        publishedYear,
        doi,
        venue: 'arXiv Preprint',
        citationCount: 0 // arXiv API doesn't return citation counts
      };

      papers.push({
        id: `arxiv_${arxivId}`,
        title,
        authors: authors.length > 0 ? authors : ['Unknown Author'],
        abstract,
        metadata,
        status: 'staged',
        addedAt: Date.now()
      });
    } catch (err) {
      console.error('Error parsing arXiv entry:', err);
    }
  }

  return papers;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!query) {
    return NextResponse.json({ error: 'Search query parameter "q" is required.' }, { status: 400 });
  }

  const normalizedQuery = query.trim();

  // Run search on arXiv and Semantic Scholar in parallel (with try-catch safety)
  const [arxivResults, s2Results] = await Promise.all([
    fetchArxiv(normalizedQuery, limit).catch(err => {
      console.error('arXiv Search Error:', err);
      return [];
    }),
    fetchSemanticScholar(normalizedQuery, limit).catch(err => {
      console.error('Semantic Scholar Search Error:', err);
      return [];
    })
  ]);

  // Merge and deduplicate results by Normalized Title
  const mergedPapers: DocumentSource[] = [];
  const seenTitles = new Set<string>();

  const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Prioritize Semantic Scholar results since they have citation count metrics
  for (const paper of s2Results) {
    const norm = normalizeTitle(paper.title);
    if (!seenTitles.has(norm)) {
      seenTitles.add(norm);
      mergedPapers.push(paper);
    }
  }

  for (const paper of arxivResults) {
    const norm = normalizeTitle(paper.title);
    if (!seenTitles.has(norm)) {
      seenTitles.add(norm);
      mergedPapers.push(paper);
    } else {
      // If we already saw the paper in S2, update S2 item's metadata with arXiv ID
      const index = mergedPapers.findIndex(p => normalizeTitle(p.title) === norm);
      if (index !== -1 && paper.metadata.arXivId) {
        mergedPapers[index].metadata.arXivId = paper.metadata.arXivId;
        // Also copy PDF URL if S2 didn't find one
        if (!mergedPapers[index].metadata.pdfUrl) {
          mergedPapers[index].metadata.pdfUrl = paper.metadata.pdfUrl;
        }
      }
    }
  }

  return NextResponse.json({ papers: mergedPapers.slice(0, limit) });
}

// Fetch helper for arXiv API
async function fetchArxiv(query: string, limit: number): Promise<DocumentSource[]> {
  const searchUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}`;
  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'MultiPaperResearchAnalyst/1.0'
    },
    // Prevent aggressive proxy caching
    next: { revalidate: 60 }
  });

  if (!response.ok) {
    throw new Error(`arXiv API responded with status ${response.status}`);
  }

  const xmlText = await response.text();
  return parseArxivXml(xmlText);
}

// Fetch helper for Semantic Scholar API
async function fetchSemanticScholar(query: string, limit: number): Promise<DocumentSource[]> {
  const fields = 'title,authors,year,citationCount,venue,publicationDate,abstract,url,openAccessPdf';
  const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`;
  
  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MultiPaperResearchAnalyst/1.0'
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API responded with status ${response.status}`);
  }

  const data = await response.json();
  if (!data.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((item: any): DocumentSource => {
    const authors = item.authors ? item.authors.map((a: any) => a.name) : ['Unknown Author'];
    const metadata: PaperMetadata = {
      citationCount: item.citationCount || 0,
      venue: item.venue || 'Unknown Venue',
      publicationDate: item.publicationDate || '',
      publishedYear: item.year || undefined,
      url: item.url,
      pdfUrl: item.openAccessPdf?.url || undefined
    };

    return {
      id: `s2_${item.paperId}`,
      title: item.title || 'Untitled Semantic Scholar Paper',
      authors,
      abstract: item.abstract || '',
      metadata,
      status: 'staged',
      addedAt: Date.now()
    };
  });
}
