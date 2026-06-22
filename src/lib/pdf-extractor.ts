/**
 * Extracts raw text from a PDF file on the client-side.
 * Runs only in the browser.
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (processed: number, total: number) => void
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction can only be run in the browser.');
  }

  // Dynamically import pdfjs-dist only inside the function when run in the browser.
  // This prevents DOMMatrix / browser-only errors during Next.js SSR pre-rendering.
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configure the worker from a CDN matching the library version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  
  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
        
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      
      if (onProgress) {
        onProgress(i, numPages);
      }
    } catch (pageError) {
      console.error(`Error reading text on page ${i}:`, pageError);
      fullText += `--- Page ${i} (Extraction Failed) ---\n\n`;
    }
  }

  return fullText;
}
