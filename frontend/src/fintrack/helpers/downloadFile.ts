// frontend/src/fintrack/helpers/downloadFile.ts
//
// Runs an authenticated GET that answers a file, and saves it under the name
// the server chose (PLAN_EXPORT.md §11).
//
// axios does not switch responseType by status: a 400/403/422 still arrives
// as a Blob, not as JSON, because the request asked for a Blob before the
// server had a chance to answer. The error path reads that Blob back as text
// and parses it, rather than saving the error body as if it were the file.

import { AxiosError } from 'axios';
import { authFetch } from '../../auth/auth_utils/authFetch';

const FILENAME_PATTERN = /filename="?([^";]+)"?/;

const filenameFrom = (contentDisposition: string | undefined, fallback: string): string =>
 contentDisposition?.match(FILENAME_PATTERN)?.[1] ?? fallback;

const errorMessageFrom = async (error: unknown): Promise<string> => {
 const data = (error as AxiosError<Blob>)?.response?.data;

 if (data instanceof Blob) {
  try {
   const parsed = JSON.parse(await data.text()) as { message?: string };
   if (parsed.message) return parsed.message;
  } catch {
   // The error body was not JSON either; fall through to the generic message.
  }
 }

 return error instanceof Error ? error.message : 'The file could not be downloaded.';
};

/**
 * @param url - the export endpoint
 * @param params - query parameters, already in the shape the endpoint takes
 * @param fallbackFilename - used only when the server sent no Content-Disposition
 * @throws {Error} the server's own message when the request failed
 */
export const downloadFile = async (
 url: string,
 params: Record<string, string>,
 fallbackFilename: string,
): Promise<void> => {
 try {
  const response = await authFetch<Blob>(url, {
   method: 'GET',
   params,
   responseType: 'blob',
  });

  const filename = filenameFrom(response.headers['content-disposition'], fallbackFilename);
  const blobUrl = URL.createObjectURL(response.data);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
 } catch (error) {
  throw new Error(await errorMessageFrom(error));
 }
};
