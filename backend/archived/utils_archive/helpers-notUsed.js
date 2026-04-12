/**
 * ARCHIVO DE FUNCIONES DEPRECADAS
 * ================================
 * 
 * Estas funciones fueron movidas desde src/utils/helpers.js
 * Fecha de archive: 2026-04-12
 * Motivo: No se utilizan en el código activo del proyecto
 * 
 * Si en el futuro se necesitan, restaurar desde este archivo.
 */

// ==========================================
// 1. determineTransactionType_v1
// ==========================================
// Propósito: Versión alternativa de determineTransactionType
// Diferencia: Considera cuentas category_budget como solo apertura
// No se usa porque prefirieron la versión original

export const determineTransactionType_v1 = (
  transaction_amount,
  account_type_name
) => {
  const TRANSACTION_TYPES = {
    OPENING: 'account-opening',
    DEPOSIT: 'deposit',
    WITHDRAW: 'withdraw',
    LEND: 'lend',
    BORROW: 'borrow',
  };

  const { OPENING, DEPOSIT, WITHDRAW, LEND, BORROW } = TRANSACTION_TYPES;

  if (account_type_name === 'category_budget' || transaction_amount === 0) {
    return { transactionType: OPENING, counterTransactionType: OPENING };
  }

  if (account_type_name === 'debtor') {
    if (transaction_amount > 0) {
      return { transactionType: LEND, counterTransactionType: BORROW };
    } else {
      return { transactionType: BORROW, counterTransactionType: LEND };
    }
  }

  if (transaction_amount > 0) {
    return { transactionType: DEPOSIT, counterTransactionType: WITHDRAW };
  } else {
    return { transactionType: WITHDRAW, counterTransactionType: DEPOSIT };
  }
};

// ==========================================
// 2. validateRequiredFields
// ==========================================
// Propósito: Validar campos requeridos en formularios
// No se usa porque la validación se hace en otros lugares

export function validateRequiredFields(fields, res) {
  const missingFields = Object.entries(fields)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    const message = `Missing required fields: ${missingFields.join(', ')}`;
    console.warn(message);
    return res.status(400).json({ status: 400, message });
  }
  return null;
}

// ==========================================
// 3. getAccountTypeId
// ==========================================
// Propósito: Obtener ID de tipo de cuenta desde DB
// No se usa porque se consulta directamente en controladores

export async function getAccountTypeId(clientOrPool, accountTypeName) {
  const db = clientOrPool || pool;
  const accountTypeQuery = `SELECT * FROM account_types`;
  const accountTypeResult = await db.query(accountTypeQuery);
  const accountType = accountTypeResult.rows.find(
    (type) => type.account_type_name === accountTypeName.trim()
  );
  return accountType?.account_type_id;
}

// ==========================================
// 4. filterCurrencyId
// ==========================================
// Propósito: Filtrar ID de moneda desde datos en memoria
// Alternativa a getCurrencyId que consulta DB
// No se usa porque prefirieron consultar DB directamente

export async function filterCurrencyId(currencyTable, currencyCode) {
  const currency = currencyTable.find(
    (curr) => curr.currency_code === currencyCode
  );
  return currency?.currency_id;
}

// ==========================================
// 5. handleTransactionRecording
// ==========================================
// Propósito: Envolver recordTransaction solo si no es apertura
// No se usa porque la lógica se maneja directamente

export async function handleTransactionRecording(clientOrPool = null,
  transactionOption,
  isAccountOpening
) {
  if (!isAccountOpening) {
    return await recordTransaction(clientOrPool, transactionOption);
  }
  return {};
}

// ==========================================
// 6. formatDateToISO
// ==========================================
// Propósito: Convertir dd-mm-yyyy a ISO (yyyy-mm-dd)
// No se usa porque el backend trabaja directamente con ISO

export const formatDateToISO = (dateString) => {
  const [day, month, year] = dateString.split('-');
  return `${year}-${month}-${day}`;
};

// ==========================================
// 7. validateAndNormalizeDateFn
// ==========================================
// Propósito: Validar y normalizar fechas ISO (versión estricta con regex)
// No se usa porque prefirieron la versión más simple

export const validateAndNormalizeDateFn = (dateString) => {
  const isoRegex =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;
  if (!isoRegex.test(dateString)) {
    throw new Error(
      'Formato de fecha no válido. Use YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ'
    );
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error('Date not valid');
  }

  return date.toISOString();
};

// ==========================================
// 8. isValidDate
// ==========================================
// Propósito: Validar formato dd-mm-yyyy
// No se usa porque el frontend envía fechas en ISO

export const isValidDate = (dateString) => {
  const regex = /^\d{2}-\d{2}-\d{4}$/;
  if (!regex.test(dateString)) {
    return false;
  }
  const [day, month, year] = dateString.split('-');
  const date = new Date(`${year}-${month}-${day}`);
  return !isNaN(date.getTime());
};

// ==========================================
// 9. convertToISO
// ==========================================
// Propósito: Convertir fechas según formato (español o americano) a ISO
// No se usa porque el backend estandarizó a ISO desde el frontend

export const convertToISO = (dateString, format) => {
  let day, month, year;

  if (format === 'es') {
    [day, month, year] = dateString.split('-');
  } else if (format === 'us') {
    [month, day, year] = dateString.split('-');
  } else {
    throw new Error('Formato de fecha no soportado');
  }

  const date = new Date(`${year}-${month}-${day}`);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid Date yyyy-mm-dd');
  }

  return `${year}-${month}-${day}`;
};

// ==========================================
// 10. getMonthName
// ==========================================
// Propósito: Obtener nombre del mes a partir de número (1-12)
// No se usa porque el formateo se hace con toLocaleDateString

export function getMonthName(index) {
  const month_index = parseInt(index);
  if (month_index < 1 || month_index > 12 || isNaN(month_index)) {
    throw new Error('month index must be a number between 1 and 12.');
  }

  const monthName = new Date(2000, month_index - 1).toLocaleDateString(
    'default',
    {
      month: 'long',
    }
  );
  return monthName;
}

// ==========================================
// 11. numberToWords
// ==========================================
// Propósito: Convertir números a palabras (ej: 123 → "One Hundred Twenty Three")
// No se usa porque es una funcionalidad no requerida en el proyecto

export function numberToWords(num) {
  if (num === 0) return 'Zero';
  const units = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
  ];
  const teens = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    'Ten',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  function convertChunk(chunk) {
    if (chunk === 0) return '';
    let words = '';

    if (chunk >= 100) {
      words += units[Math.floor(chunk / 100)] + ' Hundred ';
      chunk %= 100;
    }

    if (chunk >= 20) {
      words += tens[Math.floor(chunk / 10)] + ' ';
      chunk %= 10;
    } else if (chunk >= 10) {
      words += teens[chunk - 10] + ' ';
      chunk = 0;
    }

    if (chunk > 0 && chunk < 10) {
      words += units[chunk] + ' ';
    }

    return words.trim();
  }

  let result = '';
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    result += convertChunk(millions) + ' Million ';
    num %= 1000000;
  }

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    result += convertChunk(thousands) + ' Thousand ';
    num %= 1000;
  }

  if (num > 0) {
    result += convertChunk(num);
  }
  return result.trim();
}