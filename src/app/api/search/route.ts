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
  
  // Read Semantic Scholar Key from headers, falling back to the developer key
  const s2Key = request.headers.get('x-semanticscholar-key') || 
                process.env.SEMANTIC_SCHOLAR_API_KEY || 
                's2k-IgaFq5lzt3YyD5IF0tSJRJSspaEHVhHWx4NzEY3y';

  const coreKey = request.headers.get('x-core-key') || process.env.CORE_API_KEY;
  const openAlexKey = request.headers.get('x-openalex-key') || process.env.OPENALEX_API_KEY;
  const pubMedKey = request.headers.get('x-pubmed-key') || process.env.PUBMED_API_KEY;

  if (!query) {
    return NextResponse.json({ error: 'Search query parameter "q" is required.' }, { status: 400 });
  }

  const engine = searchParams.get('engine') || 'all';

  const normalizedQuery = query.trim();
  let s2Warning: string | null = null;

  // Run search conditionally based on engine parameter
  const fetchArxivPromise = (engine === 'all' || engine === 'arxiv')
    ? fetchArxiv(normalizedQuery, limit).catch(err => {
        console.error('arXiv Search Error:', err);
        return [];
      })
    : Promise.resolve([]);

  const fetchS2Promise = (engine === 'all' || engine === 'semanticscholar')
    ? fetchSemanticScholar(normalizedQuery, limit, s2Key).catch(err => {
        console.error('Semantic Scholar Search Error:', err);
        if (err.message?.includes('429')) {
          s2Warning = 'Semantic Scholar rate limit exceeded (429). Please wait a few minutes or add a Semantic Scholar API Key in Settings to search business papers.';
        } else {
          s2Warning = err.message || 'Semantic Scholar search failed.';
        }
        return [];
      })
    : Promise.resolve([]);

  const fetchPubMedPromise = (engine === 'all' || engine === 'pubmed')
    ? fetchPubMed(normalizedQuery, limit, pubMedKey).catch(err => {
        console.error('PubMed Search Error:', err);
        return [];
      })
    : Promise.resolve([]);

  const fetchOpenAlexPromise = (engine === 'all' || engine === 'openalex')
    ? fetchOpenAlex(normalizedQuery, limit, openAlexKey).catch(err => {
        console.error('OpenAlex Search Error:', err);
        return [];
      })
    : Promise.resolve([]);

  const fetchCorePromise = (engine === 'all' || engine === 'core')
    ? fetchCore(normalizedQuery, limit, coreKey).catch(err => {
        console.error('CORE Search Error:', err);
        return [];
      })
    : Promise.resolve([]);

  const [arxivResults, s2Results, pubmedResults, openAlexResults, coreResults] = await Promise.all([
    fetchArxivPromise,
    fetchS2Promise,
    fetchPubMedPromise,
    fetchOpenAlexPromise,
    fetchCorePromise
  ]);

  // Merge and deduplicate results by Normalized Title
  const mergedPapers: DocumentSource[] = [];
  const seenTitles = new Set<string>();

  const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Prioritize Semantic Scholar and OpenAlex results since they have citation count metrics
  for (const paper of [...s2Results, ...openAlexResults, ...coreResults, ...pubmedResults]) {
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
      // If we already saw the paper, update metadata with arXiv ID
      const index = mergedPapers.findIndex(p => normalizeTitle(p.title) === norm);
      if (index !== -1 && paper.metadata.arXivId) {
        mergedPapers[index].metadata.arXivId = paper.metadata.arXivId;
        // Also copy PDF URL if earlier fetch didn't find one
        if (!mergedPapers[index].metadata.pdfUrl) {
          mergedPapers[index].metadata.pdfUrl = paper.metadata.pdfUrl;
        }
      }
    }
  }

  return NextResponse.json({ 
    papers: mergedPapers.slice(0, limit),
    warning: s2Warning
  });
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

let s2RequestQueue = Promise.resolve();
let lastS2RequestTime = 0;

// Fetch helper for Semantic Scholar API with rate limiting
async function fetchSemanticScholar(query: string, limit: number, apiKey?: string): Promise<DocumentSource[]> {
  return new Promise<DocumentSource[]>((resolve, reject) => {
    s2RequestQueue = s2RequestQueue
      .then(async () => {
        try {
          const now = Date.now();
          const timeSinceLast = now - lastS2RequestTime;
          if (timeSinceLast < 1200) {
            const delay = 1200 - timeSinceLast;
            await new Promise(r => setTimeout(r, delay));
          }
          lastS2RequestTime = Date.now();
          const res = await fetchSemanticScholarRaw(query, limit, apiKey);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      })
      .catch((err) => {
        // Prevent broken queue links, fallback so future queries still execute
        reject(err);
      });
  });
}

// Raw fetch logic for Semantic Scholar API
async function fetchSemanticScholarRaw(query: string, limit: number, apiKey?: string): Promise<DocumentSource[]> {
  const fields = 'title,authors,year,citationCount,venue,publicationDate,abstract,url,openAccessPdf';
  const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'MultiPaperResearchAnalyst/1.0'
  };

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch(searchUrl, {
    method: 'GET',
    headers,
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

let pubMedRequestQueue = Promise.resolve();
let lastPubMedRequestTime = 0;

// Fetch helper for PubMed
async function fetchPubMed(query: string, limit: number, apiKey?: string | null): Promise<DocumentSource[]> {
  return new Promise<DocumentSource[]>((resolve, reject) => {
    pubMedRequestQueue = pubMedRequestQueue
      .then(async () => {
        try {
          const now = Date.now();
          const delayRequired = apiKey ? 150 : 400; // 10/s with key, 3/s without
          const timeSinceLast = now - lastPubMedRequestTime;
          if (timeSinceLast < delayRequired) {
            await new Promise(r => setTimeout(r, delayRequired - timeSinceLast));
          }
          lastPubMedRequestTime = Date.now();
          const res = await fetchPubMedRaw(query, limit, apiKey);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      })
      .catch(reject);
  });
}

async function fetchPubMedRaw(query: string, limit: number, apiKey?: string | null): Promise<DocumentSource[]> {
  const apiKeyParam = apiKey ? `&api_key=${apiKey}` : '';
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json${apiKeyParam}`;
  const searchRes = await fetch(searchUrl, { next: { revalidate: 60 } });
  if (!searchRes.ok) throw new Error(`PubMed Search error: ${searchRes.status}`);
  
  const searchData = await searchRes.json();
  const ids = searchData.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml${apiKeyParam}`;
  const fetchRes = await fetch(fetchUrl, { next: { revalidate: 60 } });
  if (!fetchRes.ok) throw new Error(`PubMed Fetch error: ${fetchRes.status}`);
  
  const xmlText = await fetchRes.text();
  const papers: DocumentSource[] = [];
  const articleMatches = xmlText.match(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g) || [];
  
  for (const article of articleMatches) {
    const pmidMatch = article.match(/<PMID[^>]*>([\s\S]*?)<\/PMID>/);
    const pmid = pmidMatch ? pmidMatch[1].trim() : '';
    
    const titleMatch = article.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
    const title = titleMatch ? cleanText(titleMatch[1]) : 'Untitled PubMed Paper';
    
    const abstractMatches = article.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g) || [];
    const abstract = abstractMatches.map(a => {
      const t = a.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
      return t ? cleanText(t[1]) : '';
    }).join('\n');

    const authorMatches = article.match(/<Author[^>]*>([\s\S]*?)<\/Author>/g) || [];
    const authors = authorMatches.map(a => {
      const ln = a.match(/<LastName>([\s\S]*?)<\/LastName>/);
      const fn = a.match(/<ForeName>([\s\S]*?)<\/ForeName>/);
      return `${fn ? fn[1] : ''} ${ln ? ln[1] : ''}`.trim();
    }).filter(a => a);

    const yearMatch = article.match(/<PubDate>[\s\S]*?<Year>([\s\S]*?)<\/Year>[\s\S]*?<\/PubDate>/);
    const monthMatch = article.match(/<PubDate>[\s\S]*?<Month>([\s\S]*?)<\/Month>[\s\S]*?<\/PubDate>/);
    const pubDate = `${monthMatch ? cleanText(monthMatch[1]) : ''} ${yearMatch ? cleanText(yearMatch[1]) : ''}`.trim();
    
    const journalMatch = article.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>[\s\S]*?<\/Journal>/);
    const venue = journalMatch ? cleanText(journalMatch[1]) : 'PubMed';

    const doiMatch = article.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/);
    
    const metadata: PaperMetadata = {
      venue: venue,
      publishedYear: yearMatch ? parseInt(cleanText(yearMatch[1])) : undefined,
      publicationDate: pubDate || undefined,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      doi: doiMatch ? cleanText(doiMatch[1]) : undefined,
      citationCount: 0
    };

    papers.push({
      id: `pubmed_${pmid}`,
      title,
      authors: authors.length > 0 ? authors : ['Unknown Author'],
      abstract,
      metadata,
      status: 'staged',
      addedAt: Date.now()
    });
  }
  return papers;
}

let openAlexRequestQueue = Promise.resolve();
let lastOpenAlexRequestTime = 0;

// Fetch helper for OpenAlex
async function fetchOpenAlex(query: string, limit: number, apiKey?: string | null): Promise<DocumentSource[]> {
  return new Promise<DocumentSource[]>((resolve, reject) => {
    openAlexRequestQueue = openAlexRequestQueue
      .then(async () => {
        try {
          const now = Date.now();
          const timeSinceLast = now - lastOpenAlexRequestTime;
          if (timeSinceLast < 150) { // 10 requests per second -> ~100ms
            await new Promise(r => setTimeout(r, 150 - timeSinceLast));
          }
          lastOpenAlexRequestTime = Date.now();
          const res = await fetchOpenAlexRaw(query, limit, apiKey);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      })
      .catch(reject);
  });
}

async function fetchOpenAlexRaw(query: string, limit: number, apiKey?: string | null): Promise<DocumentSource[]> {
  let authParam = '';
  if (apiKey) {
    if (apiKey.includes('@')) {
      authParam = `&mailto=${encodeURIComponent(apiKey.trim())}`;
    } else {
      authParam = `&api_key=${apiKey.trim()}`;
    }
  }
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}${authParam}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`OpenAlex error: ${res.status} ${await res.text()}`);
  
  const data = await res.json();
  return (data.results || []).map((item: any) => {
    let abstract = '';
    if (item.abstract_inverted_index) {
      const index = item.abstract_inverted_index;
      const words: string[] = [];
      for (const [word, positions] of Object.entries(index)) {
        (positions as number[]).forEach(pos => {
          words[pos] = word;
        });
      }
      abstract = words.join(' ');
    }

    const metadata: PaperMetadata = {
      citationCount: item.cited_by_count || 0,
      venue: item.primary_location?.source?.display_name || 'OpenAlex Work',
      publicationDate: item.publication_date || undefined,
      publishedYear: item.publication_year,
      url: item.id,
      pdfUrl: item.open_access?.oa_url || undefined,
      doi: item.doi
    };
    
    return {
      id: `openalex_${item.id.split('/').pop()}`,
      title: item.title || 'Untitled OpenAlex Paper',
      authors: item.authorships?.map((a: any) => a.author?.display_name) || ['Unknown Author'],
      abstract,
      metadata,
      status: 'staged',
      addedAt: Date.now()
    };
  });
}

let coreRequestQueue = Promise.resolve();
let lastCoreRequestTime = 0;

// Fetch helper for CORE
async function fetchCore(query: string, limit: number, apiKey?: string): Promise<DocumentSource[]> {
  return new Promise<DocumentSource[]>((resolve, reject) => {
    coreRequestQueue = coreRequestQueue
      .then(async () => {
        try {
          const now = Date.now();
          const timeSinceLast = now - lastCoreRequestTime;
          if (timeSinceLast < 200) { 
            await new Promise(r => setTimeout(r, 200 - timeSinceLast));
          }
          lastCoreRequestTime = Date.now();
          const res = await fetchCoreRaw(query, limit, apiKey);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      })
      .catch(reject);
  });
}

async function fetchCoreRaw(query: string, limit: number, apiKey?: string): Promise<DocumentSource[]> {
  if (!apiKey) {
    throw new Error('CORE API requires an API key in settings or environment variables.');
  }
  
  const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    next: { revalidate: 60 }
  });
  
  if (!res.ok) throw new Error(`CORE API error: ${res.status}`);
  const data = await res.json();
  
  return (data.results || []).map((item: any) => {
    const metadata: PaperMetadata = {
      citationCount: item.citationCount || 0,
      venue: item.publisher || item.journals?.[0]?.title || 'CORE Paper',
      publicationDate: item.publishedDate || undefined,
      publishedYear: item.publishedDate ? parseInt(item.publishedDate.substring(0, 4)) : undefined,
      url: item.downloadUrl || item.sourceFulltextUrls?.[0],
      pdfUrl: item.downloadUrl || undefined,
      doi: item.doi
    };
    
    return {
      id: `core_${item.id}`,
      title: item.title || 'Untitled CORE Paper',
      authors: item.authors?.map((a: any) => a.name) || ['Unknown Author'],
      abstract: item.abstract || '',
      metadata,
      status: 'staged',
      addedAt: Date.now()
    };
  });
}
