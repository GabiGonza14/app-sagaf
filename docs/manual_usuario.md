# Manual de Usuario — SAGAF

El Sistema Automatizado de Gestión de Análisis Financiero (SAGAF) permite el reporte, análisis y seguimiento de Reportes de Operaciones Sospechosas (ROS) de manera segura, con base en el marco normativo panameño (incluida la Ley 81 de Protección de Datos).

Este manual está dividido por **Roles de Usuario**. Seleccione su rol para conocer los flujos que le corresponden.

---

## 1. Sujeto Obligado (Entidad Reportante)

El sujeto obligado es el usuario externo (Bancos, Inmobiliarias, Cooperativas, etc.) responsable de identificar y reportar operaciones inusuales.

### 1.1 Iniciar Sesión y MFA
1. Acceda al portal web de SAGAF.
2. Ingrese su correo electrónico y contraseña.
3. Se le redirigirá a la pantalla de **Verificación de Dos Factores (MFA)**. Utilice su aplicación de autenticación (ej. Google Authenticator o Microsoft Authenticator) para ingresar el código de 6 dígitos.
4. Una vez validado, entrará a su bandeja principal.

### 1.2 Registrar un nuevo ROS
1. Haga clic en el botón **"Registrar nuevo ROS"** en la barra superior.
2. Llene los datos generales.
3. **Validación de Identidad**: Ingrese la cédula o RUC de las partes involucradas (Ordenante, Beneficiario, Cliente, etc.) y haga clic en "Verificar". Por motivos de privacidad, el sistema solo mostrará el nombre de la persona si existe en la base de datos nacional. 
4. Ingrese los detalles de la operación (Monto, Tipología, Producto).
5. **Sustento Documental**: Suba los documentos requeridos (PDF, JPG, PNG). Cada documento tiene una caja de subida específica (ej. Documentos de Apertura de la Cuenta).
6. Si le falta algún documento, justifíquelo en la caja de **"Observaciones adicionales"** para que el sistema le permita enviar el reporte de todos modos.
7. Haga clic en **Enviar ROS a la UAF**. 
   > **Nota:** Si el sistema detecta que usted reportó una operación muy similar recientemente (mismas partes y montos aproximados en los últimos 30 días), le arrojará una alerta de **Duplicidad**. Puede cancelarla o continuar.

### 1.3 Subsanaciones
Si la UAF considera que su ROS está incompleto o la justificación documental es inválida, se le devolverá como **Observado**.
1. Vaya a la pestaña de **Subsanaciones**.
2. Verá el motivo exacto del documento faltante.
3. Suba el documento requerido y confirme. El caso volverá a la bandeja de la UAF automáticamente.

---

## 2. Analista UAF

El Analista es el primer filtro interno de la UAF que recibe y procesa el ROS.

### 2.1 Análisis y Evaluación de Riesgos
1. Inicie sesión (requiere MFA). 
2. Vaya a **Mesa de Entrada**. Allí verá todos los ROS recibidos.
3. Abra un ROS y revise los detalles y los documentos adjuntos.
4. **Matriz de Riesgo**: Seleccione los factores en la matriz de evaluación (ej. PEP, Paraíso Fiscal, Monto > $500k). El sistema calculará el nivel de riesgo (Alto, Medio, Bajo) automáticamente. No puede editar este nivel manualmente.
5. Emita su recomendación técnica y haga clic en **Enviar a Supervisión**.

### 2.2 Solicitar Documentos
Si al revisar el ROS nota que falta evidencia crítica:
1. En la vista del documento, haga clic en el icono de **Observar**.
2. Escriba el motivo de la falta (ej. "La tarjeta de firmas está ilegible").
3. Al marcar documentos como observados, el ROS pasa al estado **Subsanación** y se le notifica al Sujeto Obligado para que lo corrija.

---

## 3. Supervisor UAF

El Supervisor revisa el trabajo del Analista y toma la decisión final sobre el caso.

1. Vaya a la pestaña **Supervisión**.
2. Revise el ROS, los documentos y el **Nivel de Riesgo Calculado** por el Analista.
3. Emita su resolución final (Aprobado para inteligencia o Cerrado).
4. El ROS pasará a su estado de retención final a largo plazo.

---

## 4. Auditor Interno

El Auditor tiene un acceso especial de **sólo lectura** enfocado en garantizar la inmutabilidad de los procesos.

1. Acceda a la pestaña **Auditoría**.
2. Podrá ver el log histórico completo de cada ROS (cuándo se recibió, quién lo asignó, si fue devuelto, etc.).
3. El registro histórico es **Criptográficamente Seguro y a Nivel Base de Datos**: Está prohibido alterar o eliminar registros de auditoría mediante mecanismos informáticos y de base de datos.
