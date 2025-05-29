//determine transaction type from sign of amount and account_type_name.
//applicable to account creation movements

//this function considers category_budget_account with various transaction types possible.
export const determineTransactionType = (
  transaction_amount,
  account_type_name
) => {
  let transactionType = 'account-opening';
  let counterTransactionType = 'account-opening';

  if (transaction_amount === 0) {
    return { transactionType, counterTransactionType };
  }

  if (account_type_name !== 'debtor') {
    if (transaction_amount > 0) {
      transactionType = 'deposit';
      counterTransactionType = 'withdraw';
    } else {
      //case yet to be identified
      transactionType = 'withdraw';
      counterTransactionType = 'deposit';
    }
  } else {
    //for debtor accounts. lend means debtor is receiving money from user and amount is positive
    if (account_type_name === 'debtor' && transaction_amount > 0) {
      transactionType = 'lend';
      counterTransactionType = 'borrow';
    } else if (transaction_amount < 0) {
      transactionType = 'borrow';
      counterTransactionType = 'lend';
    }
  }
  return { transactionType, counterTransactionType };
};
//-----------------------------------------------------------------
//this function considers category_budget_account as account-opening transaction type only
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
//-----------------------------------------------------------------
// Helper function to validate required fields
export function validateRequiredFields(fields, res) {
  const missingFields = Object.entries(fields)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    const message = `Missing required fields: ${missingFields.join(', ')}`;
    console.warn(pc.blueBright(message));
    return res.status(400).json({ status: 400, message });
  }
  return null;
}
//---
// Helper function to get account type ID
export async function getAccountTypeId(accountTypeName) {
  const accountTypeQuery = `SELECT * FROM account_types`;
  const accountTypeResult = await pool.query(accountTypeQuery);
  const accountType = accountTypeResult.rows.find(
    (type) => type.account_type_name === accountTypeName.trim()
  );
  return accountType?.account_type_id;
}
//---
//--- check currency existence and get currency_id ------------
export async function getCurrencyId(currencyCode) {
  console.log('running:', 'getCurrencyId')
  const currencyIdResult = await pool.query({
    text: `SELECT currency_id FROM currencies WHERE currency_code = $1`,
    values: [currencyCode],
  });

  if (currencyIdResult.rows.length === 0) {
    const message = `Currency with code ${currencyCode} does not exist as catalogued.`;
    console.warn(pc.yellowBright(message));
    return res.status(404).json({ status: 404, message });
  }

  const currencyId = currencyIdResult.rows[0].currency_id;

  console.log('🚀 ~ helpers ~ currencyId:', currencyId);
}

// Helper function to get currency ID
export async function filterCurrencyId(currencyTable, currencyCode) {
  // const currencyQuery = `SELECT * FROM currencies`;
  // const currencyResult = await pool.query(currencyQuery);
  const currency = currencyTable.find(
    (curr) => curr.currency_code === currencyCode
  );
  return currency?.currency_id;
}

// Helper function to handle transaction recording
export async function handleTransactionRecording(
  transactionOption,
  isAccountOpening
) {
  if (!isAccountOpening) {
    return await recordTransaction(transactionOption);
  }
  return {};
}
//-----------------------------------------------------------------
// Función para convertir de dd-mm-yyyy a ISO 8601 - frontend to api
export const formatDateToISO = (dateString) => {
  const [day, month, year] = dateString.split('-');
  return `${year}-${month}-${day}`; // Formato YYYY-MM-DD
};

//la api recibe la fecha en formato ISO 8601, la valida y la convierte a UTC. api to db
// Función para validar y normalizar fechas
//option 1
export const validateAndNormalizeDate = (dateString) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.error('Invalid Date');
    throw new Error('Invalid Date. From validateAndNormalizeDate fn');
  }
  return date.toISOString(); // Convertir a ISO 8601 en UTC
};

//option 2
//La API debe validar que la fecha recibida esté en formato ISO 8601 y normalizarla a UTC antes de guardarla en la base de datos como TIMESTAMPTZ.Función de Validación y Normalización en la API (Node.js)

export const validateAndNormalizeDateFn = (dateString) => {
  // Validar que la fecha esté en formato ISO 8601
  const isoRegex =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;
  if (!isoRegex.test(dateString)) {
    throw new Error(
      'Formato de fecha no válido. Use YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ'
    );
  }

  // Convertir a objeto Date
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error('Date not valid');
  }

  // Normalizar a UTC y devolver en formato ISO 8601
  return date.toISOString();
};

//La API devuelve las fechas en formato ISO 8601, y el frontend las convierte al formato dd-mm-yyyy para mostrarlas al usuario
// Función para convertir de ISO 8601 a dd-mm-yyyy en el frontend
export const formatDateToDDMMYYYY = (isoDate) => {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Los meses son base 0
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

// El frontend puede validar que la fecha ingresada por el usuario esté en el formato dd-mm-yyyy
export const isValidDate = (dateString) => {
  const regex = /^\d{2}-\d{2}-\d{4}$/; // Expresión regular para dd-mm-yyyy
  if (!regex.test(dateString)) {
    return false;
  }
  const [day, month, year] = dateString.split('-');
  const date = new Date(`${year}-${month}-${day}`);
  return !isNaN(date.getTime()); // Verificar si la fecha es válida
};

// ***********************
// Función para convertir fechas de formato dd-mm-yyyy o mm-dd-yyyy a ISO 8601 -
export const convertToISO = (dateString, format) => {
  let day, month, year;

  if (format === 'es') {
    // Formato dd-mm-yyyy
    [day, month, year] = dateString.split('-');
  } else if (format === 'us') {
    // Formato mm-dd-yyyy
    [month, day, year] = dateString.split('-');
  } else {
    throw new Error('Formato de fecha no soportado');
  }

  // Validar que la fecha sea válida
  const date = new Date(`${year}-${month}-${day}`);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid Date yyyy-mm-dd');
  }

  // Devolver en formato ISO 8601 (YYYY-MM-DD)
  return `${year}-${month}-${day}`;
};
//--------------------------------------------
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
  // console.log(monthName);
}

//---------------
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



// Ejemplos de uso:
// console.log(numberToWords(0)); // "Zero"
// console.log(numberToWords(123)); // "One Hundred Twenty Three"
// console.log(numberToWords(1050)); // "One Thousand Fifty"
// console.log(numberToWords(1234567)); // "One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven"
