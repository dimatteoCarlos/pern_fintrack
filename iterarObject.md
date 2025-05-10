# Iterar Objetos Anidados en JavaScript (3 niveles)

Aquí te muestro diferentes formas de iterar objetos anidados en 3 niveles usando JavaScript, con ejemplos para cada método:

## 1. Usando `for...in` anidados (enfoque clásico)

```javascript
const objetoAnidado = {
  nivel1: {
    nivel2a: {
      nivel3a: 'valor1',
      nivel3b: 'valor2'
    },
    nivel2b: {
      nivel3c: 'valor3',
      nivel3d: 'valor4'
    }
  }
};

for (const key1 in objetoAnidado) {
  const nivel1 = objetoAnidado[key1];
  console.log(`Nivel 1: ${key1}`);
  
  for (const key2 in nivel1) {
    const nivel2 = nivel1[key2];
    console.log(`  Nivel 2: ${key2}`);
    
    for (const key3 in nivel2) {
      console.log(`    Nivel 3: ${key3} = ${nivel2[key3]}`);
    }
  }
}
```

## 2. Usando `Object.entries()` con `forEach`

```javascript
const objetoAnidado = {
  departamentos: {
    ventas: {
      manager: 'Juan',
      empleados: 5
    },
    it: {
      manager: 'María',
      empleados: 8
    }
  }
};

Object.entries(objetoAnidado).forEach(([nivel1Key, nivel1Val]) => {
  console.log(`Departamento principal: ${nivel1Key}`);
  
  Object.entries(nivel1Val).forEach(([nivel2Key, nivel2Val]) => {
    console.log(`  Sub-departamento: ${nivel2Key}`);
    
    Object.entries(nivel2Val).forEach(([nivel3Key, nivel3Val]) => {
      console.log(`    ${nivel3Key}: ${nivel3Val}`);
    });
  });
});
```

## 3. Usando recursión para profundidad variable

```javascript
function iterarObjeto(obj, nivel = 1) {
  Object.entries(obj).forEach(([key, value]) => {
    console.log(`${'  '.repeat(nivel-1)}Nivel ${nivel}: ${key}`);
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      iterarObjeto(value, nivel + 1);
    } else {
      console.log(`${'  '.repeat(nivel)}Valor: ${value}`);
    }
  });
}

const empresa = {
  sede: {
    principal: {
      direccion: 'Calle Principal 123',
      empleados: 100
    },
    secundaria: {
      direccion: 'Avenida Secundaria 456',
      empleados: 50
    }
  }
};

iterarObjeto(empresa);
```

## 4. Usando `Object.keys()` con `map()` (para transformación)

```javascript
const productos = {
  electronica: {
    televisores: {
      marca1: 'Samsung',
      marca2: 'LG'
    },
    smartphones: {
      marca1: 'Apple',
      marca2: 'Xiaomi'
    }
  }
};

// Convertir estructura anidada a array plano
const productosArray = Object.keys(productos).map(categoria => {
  return Object.keys(productos[categoria]).map(subcategoria => {
    return Object.keys(productos[categoria][subcategoria]).map(marca => {
      return {
        categoria,
        subcategoria,
        marca,
        valor: productos[categoria][subcategoria][marca]
      };
    });
  }).flat();
}).flat();

console.log(productosArray);
```

## 5. Usando funciones modernas (flatMap)

```javascript
const biblioteca = {
  ficcion: {
    cienciaFiccion: {
      libro1: 'Dune',
      libro2: 'Fundación'
    },
    fantasia: {
      libro1: 'El Señor de los Anillos',
      libro2: 'Harry Potter'
    }
  }
};

const todosLibros = Object.entries(biblioteca).flatMap(([genero, subgeneros]) => 
  Object.entries(subgeneros).flatMap(([subgenero, libros]) => 
    Object.entries(libros).map(([clave, titulo]) => ({
      genero,
      subgenero,
      clave,
      titulo
    }))
  )
);

console.log(todosLibros);
```

Cada método tiene sus ventajas:
- `for...in` es el más básico y compatible
- `Object.entries()` con `forEach` es más moderno y legible
- La recursión es útil cuando no conoces la profundidad del objeto
- `map()` y `flatMap()` son ideales cuando necesitas transformar los datos

¿Necesitas alguna explicación adicional sobre alguno de estos métodos?