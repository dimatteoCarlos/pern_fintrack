// frontend/src/edition/utils/dateUtils.ts

/**
 * Parsea strings de fecha de PostgreSQL a objetos Date de JS
 */
export const parsePostgresDate = (dateString: string | null | undefined): Date => {
  if (!dateString) return new Date();
  
  let parsedDate: Date;
  if (dateString.includes(' ')) {
    // Formato: "2024-01-15 15:30:00-05"
    const [datePart] = dateString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    parsedDate = new Date(year, month - 1, day);
  } else {
    // Formato: "YYYY-MM-DD"
    parsedDate = new Date(dateString);
  }

  return !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
};