# Guía de Exposición: Análisis de Estadísticas Green Data Pipelines
**Nivel: Experto / Sustentación de Grado**

## 1. Introducción: El Contexto Ambiental
"Buenos días. El proyecto que presento no es solo un dashboard; es un **Espectrómetro de Datos**. En la ingeniería tradicional, medimos latencia y throughput. Hoy, medimos **Desempeño Ecológico**."

## 2. Análisis de Métricas Top-Level (Métricas Clave)
Al exponer los cuatro números superiores:
- **Llamadas Consolidadas**: Explique que es el volumen de tráfico auditado en los últimos 30 días.
- **Carga de Carbono (g)**: Esta es la deuda climática real. Si el número sube sin aumentar el volumen de llamadas, hay una ineficiencia en el código o en la región de procesamiento.
- **Impacto de Ahorro**: Representa la optimización lograda mediante el uso de modelos más eficientes o formatos de serialización compactos. Es el "ROI Verde".
- **Consumo Energético (Wh)**: Es el dato físico. Transfiere la computación al mundo real de los voltios y vatios.

## 3. Desglose por Serialización (El corazón técnico)
**Punto Crítico**: "Aquí demostramos cómo la elección del protocolo impacta el planeta."
- **Protobuf/Avro vs JSON**: Explique que los formatos binarios ocupan menos espacio en disco y red, requiriendo menos CPU para su serialización, lo que reduce directamente el consumo de Wh.
- **Gráfica de Porcentajes**: Muestra la distribución de la carga de trabajo. Si JSON domina, hay una oportunidad de mejora inmediata.

## 4. Auditoría Diaria y Perfil de Carga (Series Temporales)
- **Gráfico de Barras (Diario)**: Identifique picos de carga. Pregunta de examen: "¿Por qué el 05-11 hubo un pico?" Respuesta: "Picos de entrenamiento o ráfagas de tráfico de usuarios."
- **Perfil de Carga por Hora (Step Line)**: Crucial para entender la "Sincronicidad con la Red". Si procesamos datos en horas pico de la red eléctrica, la intensidad de carbono es más alta. El dashboard ayuda a proponer "Scheduling" en horas valle.

## 5. Resumen de Modelos Auditados
Compare **OpenAI vs Gemini** (o los modelos usados).
- No se trata de cuál es mejor, sino de cuál es más eficiente para la tarea específica.
- La barra de progreso muestra el uso relativo, mientras que el valor en rojo muestra la carga de carbono absoluta acumulada por cada modelo.

## 6. Guion para el "Video" (Sugerencia de Pitch)
1. **(Inicio - 0:00)**: "Bienvenidos a Green Data Pipelines. En la pantalla principal vemos el pulso de nuestra infraestructura."
2. **(Exploración - 1:00)**: "Vea cómo el motor detecta automáticamente la región y ajusta la intensidad de carbono en tiempo real."
3. **(Conclusión - 2:00)**: "Gracias a esta arquitectura, hemos identificado que optimizando la serialización podemos reducir la huella de carbono en un X%."

## 7. Preguntas Frecuentes de Jurado
- **¿De dónde vienen los datos?**: "Vienen de una fuente de auditoría centralizada en formato CSV que simula o captura los logs de producción de los microservicios."
- **¿Qué es la intensidad de carbono?**: "Es la variable que une el software con la realidad de la red eléctrica: g CO2 / kWh."
