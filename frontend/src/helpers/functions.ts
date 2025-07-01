import { CurrencyType, StatusType } from '../types/types';
import { DATE_TIME_FORMAT_DEFAULT } from './constants';
//-------------------------
export function currencyFormat(
  chosenCurrency = 'USD',
  number = 0,
  countryFormat = 'en-US'
) {
  const formatFn = new Intl.NumberFormat(countryFormat, {
    style: 'currency',
    currency: chosenCurrency,
  });
  return formatFn.format(number);
}
//--------------------
export function getCurrencySymbol(chosenCurrency = 'USD') {
  try {
    // Creamos un formateador de números específicamente para extraer el símbolo.
    // Usamos 'narrowSymbol' para obtener la forma más corta del símbolo (ej. $ en lugar de US$).
    const formatter = new Intl.NumberFormat(undefined, { // 'undefined' usa la configuración regional por defecto del navegador/servidor
      style: 'currency',
      currency: chosenCurrency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0, // Asegura que no haya decimales al formatear el 0
      maximumFractionDigits: 0,
    });

    // Formateamos un número 0 y luego usamos una expresión regular
    // para quitar los dígitos, comas, puntos y espacios, dejando solo el símbolo.
    const formattedZero = formatter.format(0);
    const symbol = formattedZero.replace(/[\d.,\s]/g, '');

    // Si el símbolo resultante es una cadena vacía o es el mismo código de moneda
    // (lo que ocurre si no hay un símbolo único para esa moneda en esa configuración regional),
    // devolvemos el código de la moneda original como un fallback.
    if (symbol === '' || symbol.toUpperCase() === chosenCurrency.toUpperCase()) {
      return chosenCurrency;
    }

    return symbol;

  } catch (error) {
    // En caso de que la moneda no sea válida o haya algún otro error,
    // devolvemos el código de la moneda como fallback.
    console.error(`Error al obtener el símbolo para ${chosenCurrency}:`, error);
    return chosenCurrency;
  }
}

//--------------------
export function digitRound(n = Number.MIN_VALUE, digit = 2) {
  return Math.round(n * Math.pow(10, digit)) / Math.pow(10, digit);
}

//-------------------------
export function changeCurrency(currency: CurrencyType) {
  if (currency.toLocaleLowerCase() == 'usd') {
    return 'cop';
  } else if (currency.toLocaleLowerCase() == 'cop') {
    return 'usd';
  } else {
    return 'usd';
  }
}
//-------------------------

type OpcType = {
  currentOpc: string; //check any
  opc1: string;
  opc2: string;
  opc3: string;
};

export function genericToggle({ currentOpc, opc1, opc2, opc3 }: OpcType) {
  // Crear un arreglo con las opciones
  const options = [opc1, opc2, opc3];

  // Encontrar el índice de la opción actual en el arreglo
  const currentIndex = options.indexOf(currentOpc);

  // Si no se encuentra la opción actual (caso inesperado), retornar la primera opción
  if (currentIndex === -1) {
    return opc1;
  }

  // Calcular el siguiente índice cíclicamente
  const nextIndex = (currentIndex + 1) % options.length;

  // Retornar la siguiente opción
  return options[nextIndex];
}

//-------------------------
export function numberFormat(
  x: number | string,
  formatNumberCountry: string = 'en-US'
): string {
  // Convertir la entrada a número. Si no es válido, devolver una cadena vacía.
  const enteredNumber = parseFloat(x.toString());

  // Verificar si el valor es un número válido
  if (isNaN(enteredNumber)) {
    return 'not a number'; //  devolver '' o adecuar para lanzar un error
  }

  // Crear el formateador de números con la configuración regional.
  const formatter = new Intl.NumberFormat(formatNumberCountry, {
    useGrouping: true,
  });

  // Formatear el número y devolverlo
  return formatter.format(enteredNumber);
}

//-------------------------
export // Lista de códigos de monedas más comunes según ISO 4217 (ejemplo)
const validCurrencyCodes = new Set([
  'USD',
  'EUR',
  'COP',
  //'GBP', 'JPY',
  // 'AUD', 'CAD', 'CHF',
  // 'CNY', 'SEK',
  // 'NZD', 'MXN', 'SGD',
  // 'HKD', 'NOK', 'KRW', 'TRY', 'INR', 'BRL',
  // 'ZAR', 'RUB', 'PLN', 'DKK', 'HUF',
  // 'ILS', 'CZK', 'THB', 'MYR', 'PHP', 'IDR',
  // 'KRW', 'SAR', 'EGP', 'CLP', 'ARS', 'VND', 'PKR', 'MAD',
]);

// Función para validar un código de moneda basado en ISO 4217
export function isValidCurrencyCode(currency: string): boolean {
  // Convertir el código a mayúsculas para comparación uniforme
  const upperCurrency = currency.toUpperCase();
  // Verificar si el código está en la lista de códigos válidos
  //Method 1
  return validCurrencyCodes.has(upperCurrency);
  //-------------------------
  //Method 2
  // if (validCurrencyCodes.has(upperCurrency)) {
  //   return true;
  // }
  // Si el código no está en la lista, intentar con Intl.NumberFormat
  // try {
  //   new Intl.NumberFormat('en-US', {
  //     style: 'currency',
  //     currency: upperCurrency,
  //   }).format(100);
  //   return true; // Si no lanza error, el código de moneda es válido
  // } catch (e) {
  //   return false; // Si lanza error, el código de moneda no es válido
  // }
}
//-----------------------
// Función para formatear números con soporte opcional de moneda y decimales
export function numberFormatCurrency(
  x: number | string=0,
  decimals: number = 2, // Argumento opcional para el número de decimales (predeterminado: 2)
  currency?: string, // Argumento opcional para la moneda
  formatNumberCountry: string = 'en-US'
): string {
  // Convertir la entrada a número. Si no es válido, devolver una cadena vacía.
  const enteredNumber = parseFloat(String(x));
  // const enteredNumber = parseFloat(x.toString());

  // Verificar si el valor es un número válido
  if (isNaN(enteredNumber)) {
    return 'Not a valid number, please try again';
  }

  // Si se proporciona un código de moneda y es válido, usamos ese formato
  if (currency && isValidCurrencyCode(currency)) {
    const formatter = new Intl.NumberFormat(formatNumberCountry, {
      style: 'currency',
      currency,
      useGrouping: true,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return formatter.format(enteredNumber); // Devolvemos el número formateado como moneda
  }

  // Si no se proporciona moneda, usamos solo la configuración regional para números
  const formatter = new Intl.NumberFormat(formatNumberCountry, {
    useGrouping: true,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  // Formatear el número y devolverlo
  return formatter.format(enteredNumber);
}
//-----------
export function showDate(date: Date, countryFormat = DATE_TIME_FORMAT_DEFAULT) {
  const formattedDate = date.toLocaleDateString(countryFormat, {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  console.log(formattedDate);

  return formattedDate;
}

// export const formatDate = (dateInput: Date | string | number): string => {
//   const date = new Date(dateInput);
//   return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
// };
//-------------------------
export function isDateValid(
  dateStr: Date | string | number | undefined | null
) {
  if (dateStr === null || dateStr === undefined) {
    return false;
  }

  if (typeof dateStr === 'number') {
    return !isNaN(new Date(dateStr).getTime());
  }

  // Para Date o string
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// La API devuelve las fechas en formato ISO 8601, y el frontend las convierte al formato dd-mm-yyyy para mostrarlas al usuario

// Función para convertir de ISO 8601 a dd-mm-yyyy en el frontend
export const formatDateToDDMMYYYY = (isoDate:Date | string) => {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Los meses son base 0
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};
// Formateador de fecha (DD/MM/YYYY HH:MM)
export const formatDate = (date:Date | string ) => 
    new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

//-----------------------
export function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
//----------------
export const truncateText = (
  textContent: string = '',
  maxLength: number = 255
) => {
  if (textContent.length > maxLength) {
    textContent = textContent.slice(0, maxLength) + '...';
    return textContent;
  }
};
//-------------------------
export function validationData(stateToValidate: {
  [key: string]: string | number | Date | undefined | null;
}): {
  [key: string]: string;
} {
  const errorValidationMessages: { [key: string]: string } = {};

  for (const key in stateToValidate) {
    const value = stateToValidate[key];

    if (typeof value === 'number' && value < 0) {
      errorValidationMessages[key] = `* ${capitalize(
        key
      )} negative values are not allowed`;
      continue;
    }
    //zero is allowed
    if (
      (typeof value == 'string' && value == '') ||
      value == null ||
      value == undefined
    ) {
      errorValidationMessages[key] = `* Please provide the ${capitalize(key)}`;
      console.log('key from string validation', key)
      continue;
    }
  }
  return errorValidationMessages;
} //fn
//----------------------------------------
//-----check number format----------------
//used in input number format validation

export function checkNumberFormatValue(value: string): {
  formatMessage: string;
  valueNumber: string;
  valueToSave: number;
  isError: boolean;
} {
  const notMatching = /([^0-9.,])/g; // Pattern for invalid characters
  const onlyDotDecimalSep = /^\d*(\.\d*)?$/g; //Normal US numeric Format
  const onlyCommaDecimalSep = /^\d*(,\d*)$/g; // Only comma as decimal separator. ES numeric format
  const commaSepFormat = /^(\d{1,3})(,\d{3})*(\.\d*)?$/g; //Comma as thousand separator, point as decimal separator. US format
  const dotSepFormat = /^(\d{1,3})(\.\d{3})*(,\d*)?$/g; //Dots as thousands separator, comma as decimal separator. UK format

  //valueToSave is the number used to update the number type state value
  //no matching character
  if (notMatching.test(value)) {
    const invalidCharacters = value.match(notMatching)?.slice(0, 4);

    return {
      formatMessage: `not valid number: ${invalidCharacters}`,
      isError: true,
      valueNumber: value.toString(),
      valueToSave: 0,
    };
  }

  //normal number: point as decimal
  if (onlyDotDecimalSep.test(value)) {
    const valueNumber = !isNaN(parseFloat(value)) ? parseFloat(value) : 0;

    return {
      formatMessage: ""//'decimal point format', //'point as decimal, no th separators with optional point as decimal sep '
       ,
      valueNumber: valueNumber.toString(),
      valueToSave: valueNumber,
      isError: false,
    };
  }

  //only comma as decimal
  if (onlyCommaDecimalSep.test(value)) {
    const valueNumber = !isNaN(parseFloat(value.replace(',', '.')))
      ? parseFloat(value.replace(',', '.'))
      : 0;

    return {
      formatMessage: 'comma as decimal-sep.',
      valueNumber: valueNumber.toString(),
      valueToSave: valueNumber,
      isError: false,
    };
  }

  //comma separator, decimal dot
  if (commaSepFormat.test(value)) {
    const valueNumber = !isNaN(parseFloat(value.replace(/,/g, '')))
      ? parseFloat(value.replace(/,/g, ''))
      : 0;

    return {
      formatMessage: 'comma as th-sep, point decimal',
      valueToSave: valueNumber,
      valueNumber: value.toString(),
      isError: false,
    };
  }

  //dot as thousand separator, comma as decimal separator
  if (dotSepFormat.test(value)) {
    const valueNumber = !isNaN(
      parseFloat(value.replace(/\./g, '').replace(',', '.'))
    )
      ? parseFloat(
          parseFloat(value.replace(/\./g, '').replace(',', '.')).toFixed(2)
        ) //seems that toFixed method does not work here - check
      : 0;

    return {
      formatMessage: 'dot as th-sep, comma as decimal',
      valueToSave: valueNumber,
      valueNumber: value.toString(),
      isError: false,
    };
  }
  //----
  return {
    formatMessage: `format number not valid`,
    isError: true,
    valueNumber: '',
    valueToSave: 0,
  };
}
//------------------------------------
// ^(0([.,]\d+)?|[1-9]\d{0,2}(,\d{3})_(\.\d_)?|[1-9]\d{0,2}(\.\d{3})_(,\d_)?|[1-9]\d*([.,]\d*)?|[.,]\d+|\d+[.,])$
//------------------------------------
//is necessary to adapt the alert to the business rule to use
export const statusFn = (
  budget: number = 100,
  spent: number = 100
): StatusType => {
  //Definir reglas de negocios para los semaforos
  const diff = budget - spent;
  // const type = diff >= 0 ? 'debtor' : diff < 0 ? 'lender' : 'none';
  // const type = diff <= 0 ? 'alert' : '';
  const type = diff >= 0;
  return type;
};
