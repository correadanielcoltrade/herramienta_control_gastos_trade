# Planeacion de implementacion en todos los CAVs

## Objetivo

Implementar la Herramienta de Control de Gastos Trade en todos los CAVs de forma ordenada, medible y controlada, reduciendo errores operativos, fallas de adopcion, diferencias de criterio entre sedes y perdida de trazabilidad sobre seriales, legalizaciones y movimientos de inventario.

La implementacion debe asegurar que cada CAV entienda el flujo completo de la herramienta, cuente con usuarios y roles correctos, tenga informacion base validada y pueda operar sin afectar la continuidad del negocio.

## Alcance

La implementacion cubre:

- Activacion progresiva de la herramienta por CAV.
- Validacion de usuarios, roles y permisos.
- Carga o verificacion de CAVs, centros de costo y datos maestros.
- Capacitacion de usuarios responsables.
- Pruebas de abastecimiento, recibo, consulta y legalizacion.
- Seguimiento posterior a la salida en vivo.
- Gestion de incidencias, ajustes y estabilizacion.

No se debe liberar un CAV a produccion si no cumple los criterios minimos de preparacion, prueba y soporte descritos en este documento.

## Principios de implementacion

1. Implementar por fases, no todos los CAVs al mismo tiempo.
2. Validar datos antes de capacitar y capacitar antes de operar.
3. Probar con casos reales controlados antes de liberar masivamente.
4. Mantener responsables claros por tecnologia, operacion y negocio.
5. Documentar errores, decisiones y ajustes desde el primer piloto.
6. Medir adopcion y calidad de registro durante las primeras semanas.
7. Evitar cambios funcionales durante una salida en vivo, salvo errores criticos.

## Roles y responsabilidades

| Rol | Responsabilidad |
| --- | --- |
| Lider funcional | Define reglas de negocio, aprueba criterios de operacion y resuelve dudas de proceso. |
| Lider tecnico | Garantiza disponibilidad de backend, frontend, base de datos, seguridad y despliegue. |
| Coordinador CAV | Valida usuarios del CAV, acompana capacitacion y confirma inicio de operacion. |
| Usuarios operadores | Para Registro abastecimientos, para recibos y legalizaciones segun su perfil. |
| SuperAdmin | Administra usuarios, roles, CAVs y seguimiento general. |
| Soporte | Atiende incidencias, clasifica errores y escala bloqueos tecnicos o funcionales. |

## Fases de implementacion

### Fase 0. Preparacion general / Realizado

Objetivo: dejar lista la base operativa y tecnica antes de involucrar CAVs.

Actividades:

- Confirmar version estable de la herramienta.
- Validar que backend, frontend y base de datos esten desplegados correctamente.
- Confirmar variables de entorno, conexion a base de datos y esquema `Schemas_Herramienta_Trade_gastos`.
- Ejecutar o validar migraciones.
- Confirmar disponibilidad de backups.
- Crear usuarios administradores y perfiles base.
- Validar catalogo de CAVs y centros de costo.
- Definir canal oficial de soporte.
- Definir calendario de implementacion por grupos de CAVs.

Criterios de salida:

- Ambiente productivo disponible.
- Prueba de login exitosa.
- Prueba de consulta a CAVs, usuarios y seriales exitosa.
- Roles base configurados.
- Backup inicial confirmado.
- Calendario de implementacion aprobado.

### Fase 1. Diagnostico por CAV

Objetivo: conocer el estado de cada CAV antes de activarlo.

Actividades:

- Confirmar nombre del CAV y centro de costos.
- Identificar usuarios que operaran la herramienta.
- Definir responsable principal y suplente por CAV.
- Validar que los usuarios tengan correo, rol y CAV asignado.
- Confirmar equipos disponibles para operar la herramienta.
- Verificar disponibilidad de camara o lector para escaneo, si aplica.
- Confirmar conectividad a internet.
- Identificar particularidades operativas del CAV.

Checklist por CAV:

| Item | Estado |
| --- | --- |
| CAV existe en la base de datos | Pendiente / OK |
| Centro de costos validado | Pendiente / OK |
| Usuarios creados | Pendiente / OK |
| Roles asignados | Pendiente / OK |
| Responsable del CAV definido | Pendiente / OK |
| Equipo de operacion disponible | Pendiente / OK |
| Conectividad validada | Pendiente / OK |
| Fecha de capacitacion definida | Pendiente / OK |

Criterios de salida:

- CAV listo para capacitacion.
- Usuarios y permisos revisados.
- Riesgos particulares identificados.

### Fase 2. Piloto controlado

Objetivo: validar el flujo completo con pocos CAVs antes de la expansion.

Seleccion recomendada:

- 2  CAVs con operacion representativa.
- Incluir al menos un CAV con alto volumen y uno con operacion promedio.
- Incluir usuarios con diferentes niveles de experiencia.

Actividades:

- Realizar capacitacion guiada.
- Ejecutar casos reales controlados de abastecimiento.
- Ejecutar recibo de seriales.
- Validar disponibilidad de seriales.
- Ejecutar legalizacion con firma y datos completos.
- Exportar informacion cuando aplique.
- Revisar trazabilidad en movimientos.
- Registrar dudas, errores y mejoras.

Casos minimos de prueba:

| Caso | Resultado esperado |
| --- | --- |
| Login de usuario por CAV | El usuario entra y ve informacion segun su permiso. |
| Abastecimiento de serial nuevo | El serial queda creado y enviado al CAV correspondiente. |
| Recibo de serial existente | El serial cambia a recibido/disponible segun el flujo definido. |
| Busqueda de serial disponible | El sistema permite ubicar el serial correcto. |
| Legalizacion de serial | El serial queda gastado/legalizado y con soporte de datos. |
| Intento de legalizar serial no disponible | El sistema bloquea la accion o muestra validacion. |
| Usuario de un CAV consultando otro CAV | El sistema respeta la restriccion por rol. |

Criterios de salida:

- Flujo completo probado sin errores criticos.
- Usuarios piloto pueden operar sin acompanamiento permanente.
- Incidencias clasificadas y cerradas o aceptadas.
- Ajustes necesarios documentados.
- Aprobacion del lider funcional para expansion.

### Fase 3. Ajustes despues del piloto

Objetivo: corregir hallazgos antes de liberar nuevos CAVs.

Actividades:

- Revisar incidencias del piloto.
- Clasificar cada hallazgo como critico, alto, medio o bajo.
- Corregir errores que afecten datos, permisos o flujo operativo.
- Ajustar textos, validaciones o reportes si generan confusion.
- Actualizar material de capacitacion.
- Confirmar que las correcciones no rompan flujos ya probados.
- Ejecutar una prueba corta de regresion.

Criterios de salida:

- Sin errores criticos abiertos.
- Sin errores altos que bloqueen la operacion.
- Material de capacitacion actualizado.
- Aprobacion tecnica y funcional para despliegue por grupos.

### Fase 4. Despliegue por grupos de CAVs

Objetivo: implementar gradualmente, manteniendo capacidad de soporte.

Estrategia recomendada:

- Grupo 1: CAVs piloto estabilizados.
- Grupo 2: CAVs de bajo o medio volumen.
- Grupo 3: CAVs de alto volumen.
- Grupo 4: CAVs con particularidades operativas o mayor riesgo.

Para cada grupo:

1. Validar checklist de preparacion.
2. Capacitar usuarios.
3. Ejecutar pruebas guiadas.
4. Confirmar fecha de inicio.
5. Acompanamiento durante los primeros dias.
6. Cierre formal de salida en vivo.

Capacidad sugerida:

- No activar mas CAVs de los que soporte pueda acompanar durante la primera semana.
- Evitar salidas en vivo en dias de cierre, inventarios, auditorias o alta carga operativa.
- Mantener una ventana de estabilizacion antes de activar el siguiente grupo.

Criterios de salida por grupo:

- 100% de usuarios principales capacitados.
- Accesos validados.
- Primeros registros revisados.
- Incidencias bloqueantes cerradas.
- Coordinador del CAV confirma continuidad operativa.

### Fase 5. Estabilizacion y seguimiento

Objetivo: asegurar que la herramienta se use correctamente despues de la salida en vivo.

Duracion recomendada:

- Seguimiento intensivo: primera semana.
- Seguimiento controlado: semanas 2 a 4.
- Operacion normal: despues del primer mes, si los indicadores son estables.

Indicadores sugeridos:

| Indicador | Objetivo |
| --- | --- |
| Usuarios activos por CAV | Confirmar adopcion. |
| Seriales recibidos vs enviados | Detectar diferencias operativas. |
| Legalizaciones completas | Validar calidad del registro. |
| Errores por CAV | Identificar necesidades de refuerzo. |
| Incidencias abiertas | Medir estabilidad. |
| Casos sin trazabilidad | Debe ser cero. |

Actividades:

- Revisar registros diarios durante la primera semana.
- Contactar CAVs con baja adopcion.
- Reforzar capacitacion cuando haya errores repetitivos.
- Revisar legalizaciones incompletas o inconsistentes.
- Consolidar reporte semanal de avance.
- Formalizar cierre de implementacion cuando todos los CAVs esten estables.

## Plan de capacitacion

La capacitacion debe ser practica y enfocada en el flujo real del usuario.

Temas minimos:

- Objetivo de la herramienta.
- Login y cierre de sesion.
- Roles y alcance por CAV.
- Consulta de seriales.
- Abastecimiento.
- Recibo de seriales.
- Legalizacion de gasto.
- Uso de scanner o camara, si aplica.
- Firma y datos obligatorios.
- Exportacion de informacion, si aplica.
- Errores frecuentes y como reportarlos.

Formato sugerido:

- Sesion corta de 45 a 60 minutos.
- Demostracion con casos reales.
- Practica guiada por usuario.
- Lista de preguntas frecuentes.
- Confirmacion de asistencia.

Evidencia requerida:

- Lista de usuarios capacitados.
- Fecha de capacitacion.
- CAV al que pertenecen.
- Responsable de la capacitacion.
- Observaciones o dudas pendientes.

## Gestion de incidencias

Toda incidencia debe registrarse con informacion suficiente para reproducirla.

Datos minimos:

- CAV.
- Usuario afectado.
- Fecha y hora.
- Modulo afectado.
- Serial relacionado, si aplica.
- Descripcion del problema.
- Captura de pantalla, si aplica.
- Resultado esperado.
- Resultado obtenido.
- Prioridad.

Clasificacion:

| Prioridad | Criterio | Tiempo objetivo |
| --- | --- | --- |
| Critica | Bloquea operacion o afecta datos/trazabilidad. | Atencion inmediata. |
| Alta | Afecta un flujo principal, pero existe alternativa temporal. | Mismo dia. |
| Media | Genera confusion o afecta casos no masivos. | 2 a 3 dias habiles. |
| Baja | Mejora visual, texto o ajuste menor. | Segun plan de mejoras. |

Regla importante:

Si una incidencia puede afectar datos, permisos o trazabilidad, se debe detener la expansion a nuevos CAVs hasta entender el impacto.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Usuarios sin capacitacion suficiente | Registros incorrectos o rechazo de la herramienta. | Capacitacion practica y acompanamiento inicial. |
| CAVs o centros de costo mal configurados | Informacion asignada al lugar incorrecto. | Checklist previo por CAV y validacion del lider funcional. |
| Roles incorrectos | Accesos indebidos o bloqueo operativo. | Revision de permisos antes de salida en vivo. |
| Seriales duplicados o mal registrados | Perdida de control y trazabilidad. | Validaciones de sistema y pruebas con casos reales. |
| Salida masiva sin soporte | Acumulacion de errores y baja adopcion. | Despliegue por grupos y capacidad maxima definida. |
| Cambios durante implementacion | Inestabilidad o reprocesos. | Congelar cambios no criticos durante ventanas de salida. |
| Falta de seguimiento | Errores repetidos despues del lanzamiento. | Indicadores semanales y refuerzo a CAVs con problemas. |

## Criterios para salida en vivo de un CAV

Un CAV puede iniciar operacion cuando cumpla todos estos puntos:

- Existe en la base de datos con centro de costos correcto.
- Tiene usuarios activos creados.
- Cada usuario tiene rol correcto.
- Responsable y suplente estan definidos.
- Usuarios fueron capacitados.
- Se realizo prueba de login.
- Se realizo al menos una prueba guiada del flujo aplicable.
- El CAV conoce el canal de soporte.
- No existen bloqueos criticos pendientes.
- Lider funcional aprueba la salida.

## Criterios de exito de la implementacion

La implementacion se considera exitosa cuando:

- Todos los CAVs definidos estan activos.
- Los usuarios operan sin acompanamiento permanente.
- Los seriales mantienen trazabilidad completa.
- Las legalizaciones se registran con informacion suficiente.
- Los errores criticos son cero durante la etapa de estabilizacion.
- Las incidencias recurrentes tienen plan de accion.
- Los reportes o exportaciones reflejan informacion confiable.
- El lider funcional acepta formalmente el cierre.

## Cronograma sugerido

| Semana | Actividad principal |
| --- | --- |
| Semana 1 | Preparacion general, validacion tecnica y diagnostico de CAVs. |
| Semana 2 | Capacitacion y ejecucion de piloto controlado. |
| Semana 3 | Ajustes posteriores al piloto y regresion. |
| Semana 4 | Salida en vivo grupo 1 y seguimiento. |
| Semana 5 | Salida en vivo grupo 2 y seguimiento. |
| Semana 6 | Salida en vivo grupo 3 y seguimiento. |
| Semana 7 | Salida en vivo grupo 4 y estabilizacion general. |
| Semana 8 | Cierre, reporte final y plan de mejora continua. |

El cronograma puede ajustarse segun cantidad de CAVs, volumen operativo, disponibilidad de usuarios y numero de incidencias encontradas.

## Gobierno de cambios durante la implementacion

Durante la implementacion se recomienda separar tres tipos de cambios:

| Tipo de cambio | Manejo |
| --- | --- |
| Error critico | Se corrige de inmediato y se valida antes de continuar. |
| Ajuste operativo necesario | Se evalua con lider funcional y tecnico antes de aplicarlo. |
| Mejora deseable | Se documenta para una fase posterior. |

No se recomienda mezclar salida en vivo con desarrollo de nuevas funcionalidades, porque aumenta el riesgo de errores y dificulta identificar la causa de una falla.

## Plantilla de seguimiento por CAV

| CAV | Responsable | Usuarios creados | Capacitacion | Prueba guiada | Fecha salida | Estado | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  | Pendiente | Pendiente | Pendiente |  | Pendiente |  |

Estados sugeridos:

- Pendiente.
- En diagnostico.
- Listo para capacitacion.
- Capacitado.
- En piloto.
- En vivo.
- En estabilizacion.
- Cerrado.
- Bloqueado.

## Recomendaciones finales

- Iniciar con pocos CAVs y aprender antes de escalar.
- No liberar usuarios sin rol y CAV validados.
- Revisar diariamente los primeros registros de cada CAV nuevo.
- Mantener una bitacora de decisiones y cambios.
- Usar los errores del piloto para fortalecer capacitacion y validaciones.
- Cerrar formalmente cada grupo antes de iniciar el siguiente.
- Priorizar trazabilidad y calidad de datos sobre velocidad de despliegue.
