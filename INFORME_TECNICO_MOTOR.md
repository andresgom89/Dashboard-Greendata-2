# Informe Técnico: Motor de Auditoría Green Data Pipelines
**Proyecto de Grado: Desempeño Ambiental en Ingeniería de Sistemas**

## 1. Resumen Ejecutivo
El sistema **Green Data Pipelines** es una plataforma de software diseñada para auditar, visualizar y optimizar el impacto ambiental de las operaciones de procesamiento de datos y modelos de Inteligencia Artificial. Su objetivo principal es cerrar la brecha entre la infraestructura de TI y la conciencia climática, proporcionando métricas precisas sobre la huella de carbono ($CO_2e$) y el consumo energético ($Wh$).

## 2. Arquitectura de Software
El proyecto utiliza una arquitectura **Full-Stack** moderna:
- **Backend**: Node.js con Express, actuando como el motor de cálculo y orquestador de datos.
- **Frontend**: React 18 con Vite, enfocado en visualización de datos de alto rendimiento.
- **Base de Datos/Fuente**: Sistema de archivos local (CSV) para auditoría de logs históricos y caché georreferencial (JSON).

## 3. El Motor de Cálculo (Logic Core)
La funcionalidad central reside en la capacidad de transformar "eventos de datos" en "impacto ambiental".

### 3.1. Obtención de Intensidad de Carbono Real
El motor se integra con la API de **Electricity Maps** (`api.electricitymap.org`).
- **Funcionamiento**: Consulta en tiempo real la intensidad de carbono (gramos de $CO_2$ por cada kWh generado) según la región geográfica (`CARBON_REGION`).
- **Cálculo Dinámico**: Si la API está disponible, el sistema usa datos reales de la red eléctrica local; de lo contrario, aplica un factor de seguridad de $300\text{g } CO_2/kWh$ (promedio global conservador).

### 3.2. Fórmulas de Conversión Energética
Para determinar el consumo energético ($Wh$) a partir de la huella reportada ($CO_2g$), el motor aplica la inversa de la intensidad:
$$ \text{Energía (Wh)} = \left( \frac{\text{Huella}(g)}{\text{Intensidad}(g/kWh)} \right) \times 1000 $$

### 3.3. Robustez de Datos
El motor incluye una función de **Parsing Robusto** capaz de procesar archivos CSV con inconsistencias (comas, notación científica, caracteres no numéricos), garantizando que la auditoría no se detenga ante errores sintácticos de los logs.

## 4. Tecnologías y Librerías Utilizadas
### 4.1. Core Runtime (Backend)
- **`express`**: Framework web para servir la API y los activos estáticos.
- **`csv-parse`**: Motor de parsing para archivos CSV de gran volumen (Auditoría Histórica).
- **`axios`**: Para comunicación con servicios externos de intensidad energética.
- **`dotenv`**: Gestión de variables de entorno (claves de API, región, tokens).

### 4.2. Capa de Visualización (Frontend)
- **`react`**: Librería base para la interfaz de usuario.
- **`recharts`**: Motor de gráficos basado en SVG para representar series temporales y perfiles de carga.
- **`tailwind css`**: Framework de diseño para una interfaz responsiva y de bajo peso visual.
- **`framer-motion`**: Biblioteca de animaciones para mejorar la experiencia de usuario (UX).
- **`lucide-react`**: Iconografía vectorial estándar.

## 5. Ejecución del Proyecto
1. **Fase de Ingesta**: El servidor lee el archivo `/data/pipelines_log.csv`.
2. **Fase de Enriquecimiento**: Los datos se cruzan con la caché geográfica para determinar el origen de las llamadas (OpenAI, Gemini).
3. **Fase de Agregación**: Se calculan totales por día, hora, modelo y formato de serialización.
4. **Fase de Consumo**: El Frontend solicita `/api/monthly` y renderiza el Dashboard en tiempo real.

## 6. Conclusión Ambiental
Este motor permite identificar que formatos de serialización (como **Protobuf** o **Avro**) disminuyen la carga de datos y, por ende, el tiempo de procesamiento y la huella de carbono asociada. Es una herramienta esencial para el "Green Coding" y la Ingeniería de Software Sustentable.
