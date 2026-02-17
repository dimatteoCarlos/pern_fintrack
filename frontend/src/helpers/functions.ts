//src/helpers/functions.ts
//function related to ui data presentation
// getCurrencySymbol

// ## 🚀 Key Features

// *   **`currencyFormat` & `numberFormatCurrency`**: Advanced formatters that convert raw numbers into localized currency strings. Supports custom decimal precision and regional settings (e.g., `en-US` vs `es-CO`).
// *   **`getCurrencySymbol`**: Extracts the shortest visual symbol (e.g., `$`, `€`, `£`) for any currency code using "narrow symbol" logic with reliable ISO fallbacks.
// *   **`generateCurrencyOptions`**: Dynamically builds descriptive arrays for UI dropdowns. It uses `Intl.DisplayNames` to map codes to full names (e.g., `USD` → `US Dollar`).
// *   **`digitRound`**: A precision utility that avoids common JavaScript floating-point errors by rounding strictly to a specified number of decimal places.
// *   **`genericToggle`**: A circular state helper that rotates through a set of options (`opc1` → `opc2` → `opc3` → `opc1`), perfect for multi-state filters or status buttons.
// *   **`isValidCurrencyCode`**: Validation guard that checks strings against supported ISO 4217 codes to ensure application stability.
//-------------------------
import { CurrencyType, StatusType } from '../types/types';
import { DATE_TIME_FORMAT_DEFAULT } from './constants';
export function currencyFormat(
  chosenCurrency = 'USD',
  number = 0, 
  countryFormat = 'en-US'
) {
  // console.log('currency', chosenCurrency)
  const formatFn = new Intl.NumberFormat(countryFormat, {
    style: 'currency',
    currency: chosenCurrency,
     minimumFractionDigits: 0, // Establece un mínimo de 0 decimales
     maximumFractionDigits: 1
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
    // se devuelve el código de la moneda original como un fallback.
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
// Define el tipo para el objeto de entrada si lo necesitas en otro lado
type CurrencyLocales = Record<string, string>;

// Define el tipo para el array de salida estándar
type OptionType = {
  value: string;
  label: string;
};

/**
 * Transforms a currency-locale map into a standard select option array format.
 *
 * @param CURRENCY_OPTIONS The source object of currencies and locales.
 * @returns A formatted array of options.
 */
export function generateCurrencyOptions(CURRENCY_OPTIONS: CurrencyLocales): OptionType[] {
// Empieza con la opción por defecto
  const options: OptionType[] = [{ value: '', label: 'Select currency' }];

  // Itera sobre las claves del objeto de entrada
  Object.keys(CURRENCY_OPTIONS).forEach(currencyCode => {
    // Para construir un label más descriptivo: "USD - US Dollar"
    // Usamos el API nativo de Intl.DisplayNames (Estándar 2026)
    try {
      const locale = CURRENCY_OPTIONS[currencyCode];
      // Nota: Intl.DisplayNames es compatible con la mayoría de navegadores modernos
      const currencyName = new Intl.DisplayNames([locale], { type: 'currency' }).of(currencyCode.toUpperCase());
      
      options.push({
        value: currencyCode, // 'usd'
        label: `${currencyCode.toUpperCase()} - ${currencyName}` // 'USD - US Dollar'
      });
    } catch (error) {
      // Fallback si el API de Intl falla (navegadores muy viejos)
       options.push({
        value: currencyCode,
        label: `${currencyCode.toUpperCase()}`
      });
    }
  });

  return options;
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
export const formatDateToDDMMYYYY = (isoDate:Date | string | undefined | null) => {
  if(!isoDate){return "not a valid date"}
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
export function capitalize(text: string| undefined): string {
   if(!text){return ""}
  // 1. Convertimos todo a minúsculas
  const lower = text.toLowerCase();

  // 2. Capitalizamos la primera letra del texto y después de cada punto + espacio
  const capitalized = lower.replace(/(^\w)|(\. \w)|(\.\w)/g, match => match.toUpperCase());

  return capitalized;
}

export function capitalize1(word: string | undefined) {
    if(!word){return ""}

  return word? word.charAt(0).toUpperCase() + word.slice(1):'';
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
//-------------------------------