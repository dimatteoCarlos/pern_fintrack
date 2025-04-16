Aprender a usar **GitHub para trabajo en equipo** es esencial para cualquier desarrollador. Aquí te explico **desde cero** cómo interactuar correctamente, qué son los *issues*, dónde hacer preguntas, y buenas prácticas:

---

## **1. Conceptos Básicos que Debes Dominar**
### 🔹 **Repositorio (Repo)**
- Es la carpeta del proyecto en GitHub (contiene código, documentación, etc.).
- **Ejemplo**: `https://github.com/tu-usuario/nombre-proyecto`

### 🔹 **Branch (Rama)**
- Versión paralela del código donde trabajas sin afectar la rama principal (`main`/`master`).
- **Buena práctica**:  
  ```bash
  git checkout -b mi-rama  # Crea una rama nueva
  ```

### 🔹 **Pull Request (PR) / Merge Request (MR)**
- Solicitud para fusionar tu rama con la principal. Aquí el equipo revisa tu código.

### 🔹 **Issue**
- Es como un "ticket" para reportar **bugs**, proponer **mejoras** o discutir ideas.  
- **Ejemplo**: *"El botón de login no funciona en móviles"*.

---

## **2. Dónde Hacer Preguntas y Comentarios**
### ✅ **En Issues (Recomendado para temas importantes)**
- Usa *issues* para:
  - Reportar errores.
  - Proponer nuevas funcionalidades.
  - Discutir ideas técnicas.
- **Cómo crear uno**:
  1. Ve a la pestaña **"Issues"** en el repo.
  2. Haz clic en **"New Issue"**.
  3. Elige una plantilla (si existe) o escribe tu pregunta.

**Ejemplo de título y cuerpo de un *issue***:  
```
Título: [Bug] El formulario de contacto no envía datos en iOS  
Cuerpo:  
- **Pasos para reproducir**:  
  1. Abrir la app en iPhone.  
  2. Llenar el formulario.  
  3. Hacer clic en "Enviar".  
- **Comportamiento esperado**: Debería mostrar "Mensaje enviado".  
- **Error actual**: No pasa nada.  
```

### ✅ **En Pull Requests (PRs)**
- Si estás revisando código de un compañero, haz comentarios **directamente en los archivos modificados** en la pestaña **"Files changed"** del PR.  
- Usa **@menciones** para notificar a alguien:  
  ```markdown
  @usuario ¿Por qué usaste `var` en lugar de `const` aquí?
  ```

### ✅ **En Discussions (Foros de debate)**
- Algunos repos tienen una pestaña **"Discussions"** (como un foro). Ideal para preguntas abiertas.  
- **Ejemplo**:  
  *"¿Qué librería recomiendan para gráficos en React?"*

### ❌ **Evita**:
- Preguntar por *Chat* (Slack, Discord) si no es urgente. GitHub deja registro para futuras consultas.

---

## **3. Flujo de Trabajo Típico en Equipo**
1. **Creas un *issue***: *"Añadir paginación a la tabla de usuarios"*.  
2. **Haces una rama**:  
   ```bash
   git checkout -b feature/paginacion
   ```
3. **Subes tus cambios**:  
   ```bash
   git push origin feature/paginacion
   ```
4. **Abres un PR** desde tu rama hacia `main`.  
5. **El equipo revisa** y comenta.  
6. **Haces ajustes** (si hay feedback).  
7. **Mergeas el PR** (o un *maintainer* lo hace).  

---

## **4. Buenas Prácticas en Comentarios y Preguntas**
### 📌 **En Issues**:
- **Sé específico**: Incluye pasos para reproducir errores.  
- **Usa etiquetas**: `bug`, `enhancement`, `question`.  
- **Adjunta capturas** o logs si es necesario.

### 📌 **En PRs**:
- **Explica tus cambios**:  
  ```markdown
  ## Cambios realizados  
  - Se añadió paginación a la tabla.  
  - Se corrigió el bug #123.  
  ```
- **Pide revisión**: Usa *"Reviewers"* para asignar a compañeros.

### 📌 **Al comentar código**:
- **Sé constructivo**:  
  ❌ *"Esto está mal"*  
  ✅ *"¿Qué tal si usamos `map` en lugar de `for` para mejor legibilidad?"*

---

## **5. Recursos para Practicar**
- **GitHub Skills**: Cursos interactivos oficiales: [skills.github.com](https://skills.github.com/)  
- **GitHub Docs**: [docs.github.com](https://docs.github.com/es)  
- **Simula un proyecto en equipo**: Haz un repo con un amigo y practica *issues*, *PRs*, etc.

---

## **6. Ejemplo Real de Interacción**
### **Paso 1**: Alguien reporta un *issue*:  
> *"El logo no se ve bien en móviles"*.  

### **Paso 2**: Tú lo asignas y trabajas en una rama:  
```bash
git checkout -b fix/logo-mobile
```

### **Paso 3**: Subes los cambios y abres un PR:  
> *"Se ajustó el tamaño del logo en dispositivos pequeños (fixes #45)"*.  

### **Paso 4**: Un compañero aprueba y mergea.  

---

Con esto, **estarás colaborando como un profesional**. ¿Necesitas ayuda con algún flujo en específico? 😊