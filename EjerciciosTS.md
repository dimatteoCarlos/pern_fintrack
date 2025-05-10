Claro, aquí tienes una serie de **ejercicios resueltos de TypeScript** enfocados en los conceptos clave que estás manejando en tu código, como `keyof`, `mapped types`, `conditional types`, y `type guards`.

---

### 🧠 **Ejercicio 1: keyof + tipo derivado**

**Objetivo:** Extraer las claves de un objeto como un tipo.

```ts
type User = {
  id: number;
  name: string;
  email: string;
};

type UserKeys = keyof User; // "id" | "name" | "email"

// Usando UserKeys para crear una función genérica
function getUserProperty(user: User, key: UserKeys) {
  return user[key];
}

const u: User = { id: 1, name: "Ana", email: "ana@mail.com" };
const email = getUserProperty(u, "email"); // ✅ funciona y tipa como string
```

---

### 🧠 **Ejercicio 2: Mapped Type para tipar un objeto dinámico**

**Objetivo:** Crear un objeto tipado a partir de las claves de otro tipo.

```ts
type Metrics = {
  Revenue: number;
  Profit: number;
  Expenses: number;
};

// Cada métrica puede tener un valor o estar en loading
type MetricState = {
  [K in keyof Metrics]: { value: Metrics[K]; loading: boolean };
};

// Resultado:
const state: MetricState = {
  Revenue: { value: 1000, loading: false },
  Profit: { value: 200, loading: true },
  Expenses: { value: 800, loading: false },
};
```

---

### 🧠 **Ejercicio 3: Conditional Types con type guards**

**Objetivo:** Usar funciones que refinan el tipo dinámicamente.

```ts
type ApiResponse = User | Error;

function isUser(data: ApiResponse): data is User {
  return (data as User).email !== undefined;
}

function handleResponse(data: ApiResponse) {
  if (isUser(data)) {
    console.log(data.email); // ✅ TypeScript ahora sabe que data es User
  } else {
    console.error((data as Error).message);
  }
}
```

---

### 🧠 **Ejercicio 4: Genéricos + keyof + indexed access types**

**Objetivo:** Crear una función genérica reutilizable para acceder a valores de un objeto.

```ts
function pluckValue<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const product = { id: 5, price: 99.99, title: "Book" };
const price = pluckValue(product, "price"); // ✅ type: number
```

---

### 🧠 **Ejercicio 5: Endpoint API con mapped type genérico**

**Objetivo:** Tipar correctamente una función que consume múltiples endpoints.

```ts
type APIMap = {
  users: User[];
  stats: { total: number };
  profile: User;
};

async function fetchAPI<K extends keyof APIMap>(
  endpoint: K
): Promise<APIMap[K]> {
  const res = await fetch(`/api/${endpoint}`);
  return res.json();
}

async function example() {
  const users = await fetchAPI("users"); // ✅ TypeScript infiere User[]
}
```

---

¿Quieres que te prepare una hoja de ejercicios con *respuestas ocultas* para practicar tú mismo?

Perfecto. Aquí tienes una **hoja de ejercicios de TypeScript resueltos**, con la respuesta visible y explicada. Cada ejercicio incluye:

* ✅ Objetivo didáctico
* 💡 Enunciado
* ✅ Solución
* 🧠 Explicación

---

## 🧾 **Ejercicio 1: `keyof` y funciones genéricas**

### ✅ Objetivo:

Usar `keyof` para crear una función que solo acepte claves válidas de un objeto.

### 💡 Enunciado:

Define un tipo `User`, luego crea una función que devuelva el valor de una propiedad específica.

### ✅ Solución:

```ts
type User = {
  id: number;
  name: string;
  age: number;
};

type UserKeys = keyof User; // "id" | "name" | "age"

function getUserProp(user: User, key: UserKeys) {
  return user[key];
}

const user: User = { id: 1, name: "Carlos", age: 65 };
const result = getUserProp(user, "name"); // "Carlos"
```

### 🧠 Explicación:

`keyof User` crea un *union type* de las claves. Luego, la función acepta solo esas claves.

---

## 🧾 **Ejercicio 2: Mapped Types**

### ✅ Objetivo:

Crear un objeto tipado con los mismos nombres de clave pero con nuevos valores.

### 💡 Enunciado:

Tienes un tipo `KPI` con claves numéricas. Quieres crear un objeto que almacene el estado de carga y el dato.

### ✅ Solución:

```ts
type KPI = {
  Sales: number;
  Profit: number;
};

type KPIState = {
  [K in keyof KPI]: {
    value: KPI[K];
    loading: boolean;
  };
};

const kpiState: KPIState = {
  Sales: { value: 2000, loading: false },
  Profit: { value: 500, loading: true },
};
```

### 🧠 Explicación:

Usamos `K in keyof KPI` para recorrer claves y reconstruir un nuevo tipo manteniendo tipos originales con nuevas estructuras.

---

## 🧾 **Ejercicio 3: Type Guard personalizado**

### ✅ Objetivo:

Usar funciones para refinar el tipo real de un dato en tiempo de ejecución.

### 💡 Enunciado:

Tienes una respuesta que puede ser `User` o `Error`. Crea un type guard para diferenciar.

### ✅ Solución:

```ts
type User = { id: number; email: string };
type ApiResult = User | Error;

function isUser(data: ApiResult): data is User {
  return (data as User).email !== undefined;
}

function handleResult(result: ApiResult) {
  if (isUser(result)) {
    console.log(result.email); // ✅ seguro, es User
  } else {
    console.error(result.message); // Error
  }
}
```

### 🧠 Explicación:

`data is User` le dice a TypeScript que dentro del `if`, el tipo puede tratarse como `User`.

---

## 🧾 **Ejercicio 4: Genéricos con `keyof` y acceso indexado**

### ✅ Objetivo:

Crear una función genérica reutilizable para acceder a propiedades de un objeto con tipos seguros.

### 💡 Enunciado:

Crea una función `pluck` que reciba un objeto genérico `T` y una clave `K` de ese objeto.

### ✅ Solución:

```ts
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const product = { id: 100, name: "Tablet", price: 899.99 };
const name = pluck(product, "name"); // string
```

### 🧠 Explicación:

`K extends keyof T` restringe `K` a ser solo una clave de `T`. Y `T[K]` devuelve el tipo del valor correspondiente.

---

## 🧾 **Ejercicio 5: Genérico de respuesta de API con mapped type**

### ✅ Objetivo:

Crear una función que devuelva diferentes respuestas según el endpoint llamado.

### 💡 Enunciado:

Define un tipo `APIEndpoints` y una función genérica que devuelva el tipo correcto según la clave.

### ✅ Solución:

```ts
type APIEndpoints = {
  profile: { name: string };
  stats: { total: number };
};

async function fetchData<K extends keyof APIEndpoints>(
  endpoint: K
): Promise<APIEndpoints[K]> {
  const res = await fetch(`/api/${endpoint}`);
  return res.json();
}

async function test() {
  const profile = await fetchData("profile"); // { name: string }
  const stats = await fetchData("stats");     // { total: number }
}
```

### 🧠 Explicación:

`K` limita el endpoint a claves de `APIEndpoints`, y el tipo de retorno depende de esa clave.

---

¿Quieres que lo convierta en un **PDF imprimible** o que prepare una **hoja de ejercicios sin respuestas para practicar**?

Aquí tienes 10 ejercicios resueltos que cubren conceptos clave de tipado en TypeScript como `keyof`, `mapped types`, `conditional types`, `infer`, `type guards`, y utilidades como `Pick`, `Omit`, `Record`, tuplas y genéricos. Puedes usarlos como guía práctica para reforzar tus conocimientos. ¿Te gustaría que prepare una segunda hoja con los mismos ejercicios pero sin las respuestas visibles para que practiques?

Perfecto, aquí tienes los **10 ejercicios con sus respuestas resueltas y explicadas**. Están enfocados en reforzar el razonamiento tipado de TypeScript como lo trabajaste en tu función `overviewFetchAll`.

---

### ✅ **Ejercicio 1 – Uso de `keyof`**

```ts
type User = {
  id: number;
  name: string;
  email: string;
};

type UserKeys = keyof User;
// Resultado: "id" | "name" | "email"
```

**✅Respuesta:** `UserKeys` es `"id" | "name" | "email"`
**💡Explicación:** `keyof` extrae las claves del tipo como un union de strings.

---

### ✅ **Ejercicio 2 – `Record<K, T>`**

```ts
type Role = 'admin' | 'editor' | 'viewer';
type Permissions = Record<Role, string[]>;

// Resultado:
const userPermissions: Permissions = {
  admin: ['read', 'write', 'delete'],
  editor: ['read', 'write'],
  viewer: ['read'],
};
```

**✅Respuesta:** Se crea un objeto que asigna un array de strings a cada clave de tipo `Role`.
**💡Explicación:** `Record` construye un objeto donde cada clave de `Role` tiene como valor `string[]`.

---

### ✅ **Ejercicio 3 – `in` en mapped types**

```ts
type ReadonlyUser<T> = {
  readonly [K in keyof T]: T[K];
};

type User = {
  name: string;
  age: number;
};

type ReadonlyUserType = ReadonlyUser<User>;
```

**✅Respuesta:** `ReadonlyUserType` será:

```ts
{
  readonly name: string;
  readonly age: number;
}
```

**💡Explicación:** Se usa `in` para mapear y aplicar `readonly` a cada propiedad.

---

### ✅ **Ejercicio 4 – `Pick<T, K>`**

```ts
type User = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
};

type BasicUser = Pick<User, 'id' | 'name'>;
```

**✅Respuesta:**

```ts
{
  id: number;
  name: string;
}
```

**💡Explicación:** `Pick` selecciona solo las claves deseadas de un tipo.

---

### ✅ **Ejercicio 5 – `Omit<T, K>`**

```ts
type FullUser = {
  id: number;
  name: string;
  password: string;
};

type PublicUser = Omit<FullUser, 'password'>;
```

**✅Respuesta:**

```ts
{
  id: number;
  name: string;
}
```

**💡Explicación:** `Omit` remueve la clave `password` del tipo.

---

### ✅ **Ejercicio 6 – Función con genérico `T` y restricción `extends`**

```ts
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: 'Ana' };
const userName = getProperty(user, 'name'); // Type: string
```

**✅Respuesta:** `userName` es de tipo `string`.
**💡Explicación:** `K extends keyof T` asegura que `key` sea una propiedad válida del objeto.

---

### ✅ **Ejercicio 7 – Type guard con retorno `x is Tipo`**

```ts
type Animal = { kind: 'animal'; legs: number };
type Human = { kind: 'human'; name: string };

function isHuman(x: Animal | Human): x is Human {
  return x.kind === 'human';
}
```

**✅Respuesta:** Dentro de `if (isHuman(x))`, `x` se trata como `Human`.
**💡Explicación:** Type guards permiten hacer narrowing para tener acceso seguro a las propiedades.

---

### ✅ **Ejercicio 8 – Conditional type + `infer`**

```ts
type ExtractArrayElement<T> = T extends (infer U)[] ? U : T;

type A = ExtractArrayElement<number[]>; // Resultado: number
type B = ExtractArrayElement<string>;   // Resultado: string
```

**✅Respuesta:**

* `A` es `number`
* `B` es `string`
  **💡Explicación:** `infer` permite capturar el tipo dentro del array.

---

### ✅ **Ejercicio 9 – Tupla tipada**

```ts
type Point = [number, number];

const p: Point = [3, 7];
// p[0]: number, p[1]: number
```

**✅Respuesta:** `Point` define una tupla de exactamente dos números.
**💡Explicación:** Se usa cuando la posición tiene significado (x, y, etc.).

---

### ✅ **Ejercicio 10 – Partial<T> + combinación con lógica de fallback**

```ts
type Config = {
  retries: number;
  timeout: number;
};

function createConfig(overrides: Partial<Config>): Config {
  return {
    retries: overrides.retries ?? 3,
    timeout: overrides.timeout ?? 1000,
  };
}

const conf = createConfig({ timeout: 500 });
```

**✅Respuesta:**

```ts
{
  retries: 3,
  timeout: 500
}
```

**💡Explicación:** `Partial<T>` permite pasar solo algunas propiedades, y `??` da valores por defecto.

---

¿Te gustaría que prepare una hoja en PDF descargable o editable en línea con estos ejercicios?


