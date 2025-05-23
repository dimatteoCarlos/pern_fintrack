DEbts.tsx

import Datepicker from '../../../general_components/datepicker/Datepicker.tsx';
import {
CurrencyType,
DebtsTrackerInputDataType,
DebtsTransactionType,
DropdownOptionType,
FormNumberInputType,
DebtType,
TopCardSelectStateType,
TransactionType,
VariantType,
} from '../../../types/types.ts';
...
//-----for old version toggle button
// const toggleType = useCallback(
// (e: React.MouseEvent<HTMLButtonElement>) => {
// e.preventDefault();

// setType((prev: DebtsTransactionType) =>
// prev === 'lend' ? 'borrow' : 'lend'
// );
// },
// []
// // [type]
// );
//---change date in datepicker
// function changeDateFn(selectedDate: Date): void {
// setDataTrack((prev) => ({ ...prev, date: selectedDate }));
// }

// TypeDateSelector.tsx

import React from 'react';
import Datepicker from './Datepicker'; // Asegúrate de que la ruta a Datepicker sea correcta

// Definimos los tipos para las props del componente
type TypeDateSelectorProps = {
type: string;
toggleType: () => void;
changeDateFn: (date: Date | null) => void;
datatrackDate: Date | null | undefined;
isReset: boolean;
};

const TypeDateSelector: React.FC<TypeDateSelectorProps> = ({
type,
toggleType,
changeDateFn,
datatrackDate,
isReset,
}) => {
return (
<div className='card__typeDate__container'>
{/_ Selector de Tipo _/}
<div className='card__typeDate--type'>
<div className='card--title'>Type</div>
<button className='card__screen--type' onClick={toggleType}>
<div className='screen--concept'>{type}</div>
</button>
</div>

      {/* Selector de Fecha */}
      <div className='card__typeDate--date'>
        <div className='card--title'>Date</div>
        <div className='card__screen--date'>
          <Datepicker
            changeDate={changeDateFn}
            date={datatrackDate ?? new Date()} // Asegúrate de que Datepicker maneje bien 'undefined' o 'null'
            variant='tracker'
            isReset={isReset}
          />
        </div>
      </div>
    </div>

);
};

export default TypeDateSelector;

Claro, aquí tienes el componente reusable utilizando types en lugar de interface, y cómo podrías definir los tipos y usarlo.

TypeDateSelector.tsx (El Componente Reusable)
TypeScript

import React from 'react';
import Datepicker from './Datepicker'; // Asegúrate de que la ruta a Datepicker sea correcta

// Definimos los tipos para las props del componente
type TypeDateSelectorProps = {
type: string;
toggleType: () => void;
changeDateFn: (date: Date | null) => void;
datatrackDate: Date | null | undefined;
isReset: boolean;
};

const TypeDateSelector: React.FC<TypeDateSelectorProps> = ({
type,
toggleType,
changeDateFn,
datatrackDate,
isReset,
}) => {
return (
<div className='card__typeDate__container'>
{/_ Selector de Tipo _/}
<div className='card__typeDate--type'>
<div className='card--title'>Type</div>
<button className='card__screen--type' onClick={toggleType}>
<div className='screen--concept'>{type}</div>
</button>
</div>

      {/* Selector de Fecha */}
      <div className='card__typeDate--date'>
        <div className='card--title'>Date</div>
        <div className='card__screen--date'>
          <Datepicker
            changeDate={changeDateFn}
            date={datatrackDate ?? new Date()} // Asegúrate de que Datepicker maneje bien 'undefined' o 'null'
            variant='tracker'
            isReset={isReset}
          />
        </div>
      </div>
    </div>

);
};

export default TypeDateSelector;
Cómo usarlo en tu componente padre
TypeScript

import React, { useState } from 'react';
import TypeDateSelector from './TypeDateSelector'; // Asegúrate de que la ruta sea correcta

// Suponiendo que 'datatrack' es un objeto en tu estado o props
// Definimos un tipo para 'datatrack' también
type DatatrackData = {
date: Date | null | undefined;
// otras propiedades de datatrack si las hay
};

const ParentComponent: React.FC = () => {
const [type, setType] = useState('Income');
const [datatrack, setDatatrack] = useState<DatatrackData>({ date: new Date() });
const [isReset, setIsReset] = useState(false); // Estado para el reseteo del Datepicker

const toggleType = () => {
setType(prevType => (prevType === 'Income' ? 'Expense' : 'Income'));
};

const changeDateFn = (newDate: Date | null) => {
setDatatrack(prevDatatrack => ({
...prevDatatrack,
date: newDate,
}));
setIsReset(false); // Resetear el estado de isReset después de un cambio de fecha
};

// Ejemplo de cómo podrías resetear el Datepicker si lo necesitas
const handleResetDate = () => {
setDatatrack(prevDatatrack => ({
...prevDatatrack,
date: null, // O new Date(), dependiendo de tu lógica de reseteo
}));
setIsReset(true);
};

return (
<div>
<h1>My App</h1>
<TypeDateSelector
        type={type}
        toggleType={toggleType}
        changeDateFn={changeDateFn}
        datatrackDate={datatrack.date}
        isReset={isReset}
      />
<button onClick={handleResetDate}>Reset Date</button>
{/_ Otros elementos de tu componente padre _/}
</div>
);
};

export default ParentComponent;
Explicación de los cambios
Uso de type en lugar de interface:
Hemos cambiado la definición de las propiedades del componente de interface TypeDateSelectorProps { ... } a type TypeDateSelectorProps = { ... };. En este contexto, para definir la forma de un objeto, type e interface son en su mayoría intercambiables. Sin embargo, type es más versátil ya que puede definir uniones (|), intersecciones (&), tuplas y más. Para objetos simples como las props, ambos funcionan bien.

Componente TypeDateSelector.tsx:

Hemos encapsulado la lógica del JSX que proporcionaste en un nuevo componente funcional de React llamado TypeDateSelector.
Este componente acepta props para hacer los valores dinámicos y las funciones reusables:
type: La cadena de texto a mostrar en el botón de tipo ('Income', 'Expense', etc.).
toggleType: Una función que se ejecutará cuando se haga clic en el botón de tipo.
changeDateFn: La función que Datepicker utilizará para actualizar la fecha.
datatrackDate: La fecha actual que se pasará al Datepicker. Se le permite ser null o undefined para mayor flexibilidad.
isReset: Un booleano que Datepicker puede usar para saber si necesita resetear su estado interno.
Manejo de datatrack.date:

En el componente original, datatrack.date ?? new Date() se usa como prop date para Datepicker. Esto asegura que si datatrack.date es null o undefined, se use la fecha actual como valor predeterminado. He mantenido esta lógica al pasar datatrackDate.
Componente Padre (ParentComponent.tsx):

Muestra cómo importar y utilizar TypeDateSelector.
Define el estado (useState) para type, datatrack y isReset, que son las variables que ahora controlan los valores que se pasan a TypeDateSelector.
Las funciones toggleType y changeDateFn (que antes estaban dentro de validateForm o directamente en tu componente principal) ahora se definen en el componente padre y se pasan como props. Esto es clave para la reutilización, ya que el componente TypeDateSelector no necesita saber cómo se actualizan estos valores, solo que hay funciones disponibles para hacerlo.
Ventajas de esta refactorización
Modularidad y Reusabilidad: Ahora tienes un componente TypeDateSelector que puedes usar en cualquier parte de tu aplicación donde necesites un selector de tipo y fecha con esa estructura, simplemente pasándole las props adecuadas.
Separación de Preocupaciones: El componente TypeDateSelector es "tonto" o "presentacional"; solo se encarga de renderizar la UI y de llamar a las funciones que se le pasan. La lógica de negocio (qué hace toggleType o changeDateFn) reside en el componente padre, lo que hace que ambos sean más fáciles de entender y mantener.
Mantenibilidad: Si necesitas cambiar el estilo o el comportamiento del selector de tipo/fecha, solo tienes que modificar TypeDateSelector.tsx. Si necesitas cambiar la lógica de cómo se actualizan los datos, lo haces en el componente padre.
