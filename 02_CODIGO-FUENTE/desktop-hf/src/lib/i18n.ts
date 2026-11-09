import { useState, useEffect } from 'react';

export type Language = 'es' | 'en' | 'pt';

const TRANSLATIONS = {
  es: {
    // Header & Navigation
    workspaceTitle: 'LetXinet MCP Workspace',
    online: 'En Línea',
    offline: 'Desconectado',
    mcpKey: 'MCP Key:',
    geminiKey: 'Gemini:',
    mistralKey: 'Mistral:',
    pending: 'Pendiente',
    verifyReconnect: 'Verificar y reconectar',
    apiPendingTooltipTitle: 'Para conectar las APIs:',
    apiPendingTooltipMcp: 'Agrega la variable MCP_API_KEY en Settings > Secrets.',
    apiPendingTooltipGemini: 'Agrega la variable GEMINI_API_KEY en Settings > Secrets.',
    apiPendingTooltipMistral: 'Agrega la variable MISTRAL_API_KEY en Settings > Secrets.',
    apiPendingTooltipClick: 'Haz clic en cualquiera de ellos para verificar y reconectar.',
    footerCredits: 'Conexión directa vía JSON-RPC 2.0.',
    footerDocLink: 'Documentación del MCP',

    // Tabs
    tabAgent: 'Agente',
    tabPlayground: 'Playground',
    tabSkills: 'Skills',
    tabSources: 'Fuentes & APIs',
    tabKeys: 'API Keys',
    tabSystemVariables: 'Variables de Sistema',
    tabProviders: 'Proveedores',

    // Agent Chat Controls & Labels
    agentTitle: 'Agente Autónomo Investigador',
    activeSkills: 'Skills Activos',
    none: 'Ninguno',
    modelLabel: 'IA:',
    detailLabel: 'Detalle/T°:',
    mechanismLabel: 'Mecanismo:',
    automatic: 'Automático',
    askPermission: 'Pedir Permiso',
    clearChat: 'Limpiar Chat',
    placeholderInput: 'Escribe tu pregunta o requerimiento de investigación autónoma con MCP...',
    suggestionsTitle: 'Sugerencias de inicio autónomo:',
    scrollBottomTitle: 'Bajar al final',
    scrollTopTitle: 'Subir al inicio',

    // Agent Tool Execution Labels
    confirmRequired: 'Confirmación Requerida',
    toolCalling: 'Llamando',
    toolSuccess: 'Completado',
    toolFailed: 'Cancelado / Error',
    requiresApprovalTitle: 'Autorización requerida',
    requiresApprovalDesc: 'El agente solicita ejecutar la herramienta mcp. Por seguridad o según tu configuración, debes conceder permiso para proceder.',
    toolApproveBtn: '✔️ Aprobar y ejecutar',
    toolRejectBtn: '❌ Denegar / Omitir',
    mcpArgumentsLabel: 'Argumentos cargados:',
    mcpResultLabel: 'Resultado Retornado por el MCP LetXinet:',
    mcpWaitingLabel: 'Esperando datos de la red LetXinet...',
    manualApproveMessage: 'Autorización aprobada de forma manual. Aquí tienes el resultado final de ejecutar la herramienta mcp "{name}" con los argumentos provistos:',
    manualRejectMessage: 'Se ha rechazado manualmente la ejecución de la herramienta "{name}". Por favor, no intentes ejecutarla nuevamente y genera tu respuesta final o busca alternativas.',

    // Console Playground
    playgroundTitle: 'Consola Técnica JSON-RPC',
    selectMcpTool: 'Seleccionar herramienta MCP',
    descriptionLabel: 'Descripción',
    argumentsJson: 'Argumentos (JSON)',
    jsonRpcParamsStructure: 'JSON-RPC params structure',
    invalidJson: 'JSON Inválido:',
    jsonErrorFix: 'Corrige el formato JSON antes de continuar.',
    executeBtn: 'Ejecutar Herramienta',
    invokingServer: 'Invocando en Servidor LetXinet...',
    serverResponse: 'Respuesta del Servidor',
    metricDuration: 's',
    copyBtn: 'Copiar',
    copySuccess: 'Copiado',
    presetAccess: 'Acceso Rápido a Presets',
    execHistoryTitle: 'Historial de Ejecución',
    emptySessionHistory: 'No hay ejecuciones registradas en esta sesión.',
    useExecuteToolPlaceholder: 'Usa "Ejecutar Herramienta" para enviar un comando al MCP',
    resultsJsonPlaceholder: 'Los resultados se formatearán aquí en JSON',

    // Skills Gallery
    skillsTitle: 'Galería de Skills',
    skillsSubtitle: 'Gana eficiencia creando y definiendo contextos reusables para tu agente e investigación.',
    importBtn: 'Importar',
    exportBtn: 'Exportar',
    createSkillBtn: 'Crear Nuevo Skill',
    editSkillTitle: 'Editar Skill',
    newSkillTitle: 'Nuevo Skill',
    skillNameLabel: 'Nombre del Skill',
    skillDescLabel: 'Descripción Breve',
    skillPromptLabel: 'Prompt / Instrucciones Base',
    placeholderSkillName: 'Ej. Mi Skill Analítico',
    placeholderSkillDesc: 'Ej. Funciona para analizar gráficos...',
    placeholderSkillPrompt: 'Escribe el prompt o comportamiento detallado que el agente o herramienta usará. Ej: Actúa como experto en física cuántica...',
    cancelBtn: 'Cancelar',
    saveSkillBtn: 'Guardar Skill',
    requiredFieldsError: 'Error: "Nombre" y "Prompt" son campos obligatorios.',
    confirmDeleteSkill: '¿Seguro que deseas eliminar este skill?',
    emptySkillsTitle: 'No hay skills guardados.',
    emptySkillsDesc: 'Crea tu primer skill para agilizar tus tareas repetitivas.',
    promptBaseLabel: 'Prompt Base:',
    importMergeConfirm: '¿Deseas fusionar los skills (Aceptar) o reemplazar los actuales (Cancelar)?',
    importMergeSuccess: 'Skills fusionados exitosamente.',
    importReplaceSuccess: 'Skills reemplazados exitosamente.',
    importFormatError: 'El archivo no contiene un formato de skills válido.',
    importReadError: 'Error al leer el archivo de skills.',

    // General Tool Quality
    preciseLow: 'Preciso / Bajo',
    creativeHigh: 'Creativo / Alto',

    // Responsive levels
    responsiveLow: 'Responsive Bajo (Compacto)',
    responsiveHigh: 'Responsive Alto (Ancho)',
    responsiveLabel: 'Ancho:',
    responsiveTooltip: 'Nivel de adaptabilidad y ancho del escritorio (Bajo = Centralizado y Enfocado, Alto = Ancho Completo)',
  },
  en: {
    // Header & Navigation
    workspaceTitle: 'LetXinet MCP Workspace',
    online: 'Online',
    offline: 'Offline',
    mcpKey: 'MCP Key:',
    geminiKey: 'Gemini:',
    mistralKey: 'Mistral:',
    pending: 'Pending',
    verifyReconnect: 'Verify and reconnect',
    apiPendingTooltipTitle: 'To connect APIs:',
    apiPendingTooltipMcp: 'Add the MCP_API_KEY variable in Settings > Secrets.',
    apiPendingTooltipGemini: 'Add the GEMINI_API_KEY variable in Settings > Secrets.',
    apiPendingTooltipMistral: 'Add the MISTRAL_API_KEY variable in Settings > Secrets.',
    apiPendingTooltipClick: 'Click any of them to verify and reconnect.',
    footerCredits: 'Direct connection via JSON-RPC 2.0.',
    footerDocLink: 'MCP Documentation',

    // Tabs
    tabAgent: 'Agent',
    tabPlayground: 'Playground',
    tabSkills: 'Skills',
    tabSources: 'Sources & APIs',
    tabKeys: 'API Keys',
    tabSystemVariables: 'System Variables',
    tabProviders: 'Providers',

    // Agent Chat Controls & Labels
    agentTitle: 'Autonomous Researcher Agent',
    activeSkills: 'Active Skills',
    none: 'None',
    modelLabel: 'AI:',
    detailLabel: 'Detail/T°:',
    mechanismLabel: 'Mechanism:',
    automatic: 'Automatic',
    askPermission: 'Ask Permission',
    clearChat: 'Clear Chat',
    placeholderInput: 'Type your question or autonomous research inquiry with MCP...',
    suggestionsTitle: 'Autonomous startup suggestions:',
    scrollBottomTitle: 'Scroll to bottom',
    scrollTopTitle: 'Scroll to top',

    // Agent Tool Execution Labels
    confirmRequired: 'Confirm Required',
    toolCalling: 'Calling',
    toolSuccess: 'Completed',
    toolFailed: 'Cancelled / Error',
    requiresApprovalTitle: 'Authorization required',
    requiresApprovalDesc: 'The agent requests to execute the mcp tool. For safety or according to your settings, you must grant permission to proceed.',
    toolApproveBtn: '✔️ Approve and execute',
    toolRejectBtn: '❌ Deny / Skip',
    mcpArgumentsLabel: 'Loaded Arguments:',
    mcpResultLabel: 'Result Returned by LetXinet MCP:',
    mcpWaitingLabel: 'Waiting for data from LetXinet network...',
    manualApproveMessage: 'Authorization manually approved. Here is the final result of executing the mcp tool "{name}" with the provided arguments:',
    manualRejectMessage: 'Execution of tool "{name}" has been manually rejected. Please do not try to run it again and generate your final response or search for alternatives.',

    // Console Playground
    playgroundTitle: 'JSON-RPC Technical Console',
    selectMcpTool: 'Select MCP Tool',
    descriptionLabel: 'Description',
    argumentsJson: 'Arguments (JSON)',
    jsonRpcParamsStructure: 'JSON-RPC params structure',
    invalidJson: 'Invalid JSON:',
    jsonErrorFix: 'Fix the JSON format before continuing.',
    executeBtn: 'Execute Tool',
    invokingServer: 'Invoking on LetXinet Server...',
    serverResponse: 'Server Response',
    metricDuration: 's',
    copyBtn: 'Copy',
    copySuccess: 'Copied',
    presetAccess: 'Quick Access Presets',
    execHistoryTitle: 'Execution History',
    emptySessionHistory: 'No executions recorded in this session.',
    useExecuteToolPlaceholder: 'Use "Execute Tool" to send a command to MCP',
    resultsJsonPlaceholder: 'Results will be formatted here in JSON',

    // Skills Gallery
    skillsTitle: 'Skills Gallery',
    skillsSubtitle: 'Gain output efficiency by creating and defining reusable contexts for your agent & research.',
    importBtn: 'Import',
    exportBtn: 'Export',
    createSkillBtn: 'Create New Skill',
    editSkillTitle: 'Edit Skill',
    newSkillTitle: 'New Skill',
    skillNameLabel: 'Skill Name',
    skillDescLabel: 'Short Description',
    skillPromptLabel: 'Prompt / Base Instructions',
    placeholderSkillName: 'e.g., My Analytical Skill',
    placeholderSkillDesc: 'e.g., Use to analyze charts and data...',
    placeholderSkillPrompt: 'Type the deep prompt or behavior instructions that the agent/tool will use. e.g., Act as an expert in quantum physics...',
    cancelBtn: 'Cancel',
    saveSkillBtn: 'Save Skill',
    requiredFieldsError: 'Error: "Name" and "Prompt" are required fields.',
    confirmDeleteSkill: 'Are you sure you want to delete this skill?',
    emptySkillsTitle: 'No skills saved.',
    emptySkillsDesc: 'Create your first skill to accelerate repetitive tasks.',
    promptBaseLabel: 'Base Prompt:',
    importMergeConfirm: 'Do you want to merge skills (OK) or replace existing ones (Cancel)?',
    importMergeSuccess: 'Skills merged successfully.',
    importReplaceSuccess: 'Skills replaced successfully.',
    importFormatError: 'File does not contain a valid skills format.',
    importReadError: 'Error reading skills file.',

    // General Tool Quality
    preciseLow: 'Precise / Low',
    creativeHigh: 'Creative / High',

    // Responsive levels
    responsiveLow: 'Low Responsive (Compact)',
    responsiveHigh: 'High Responsive (Wide)',
    responsiveLabel: 'Width:',
    responsiveTooltip: 'Workspace responsiveness scale (Low = Slim and Centered, High = Full Wide Desktop)',
  },
  pt: {
    // Header & Navigation
    workspaceTitle: 'LetXinet MCP Workspace',
    online: 'Online',
    offline: 'Desconectado',
    mcpKey: 'MCP Key:',
    geminiKey: 'Gemini:',
    mistralKey: 'Mistral:',
    pending: 'Pendente',
    verifyReconnect: 'Verificar e reconectar',
    apiPendingTooltipTitle: 'Para conectar as APIs:',
    apiPendingTooltipMcp: 'Adicione a variável MCP_API_KEY em Settings > Secrets.',
    apiPendingTooltipGemini: 'Adicione a variável GEMINI_API_KEY em Settings > Secrets.',
    apiPendingTooltipMistral: 'Adicione a variável MISTRAL_API_KEY em Settings > Secrets.',
    apiPendingTooltipClick: 'Clique em qualquer um deles para verificar e reconectar.',
    footerCredits: 'Conexão direta via JSON-RPC 2.0.',
    footerDocLink: 'Documentação do MCP',

    // Tabs
    tabAgent: 'Agente',
    tabPlayground: 'Playground',
    tabSkills: 'Skills',
    tabSources: 'Fontes & APIs',
    tabKeys: 'API Keys',
    tabSystemVariables: 'Variáveis de Sistema',
    tabProviders: 'Provedores',

    // Agent Chat Controls & Labels
    agentTitle: 'Agente Autónomo Investigador',
    activeSkills: 'Skills Ativos',
    none: 'Nenhum',
    modelLabel: 'IA:',
    detailLabel: 'Detalhe/T°:',
    mechanismLabel: 'Mecanismo:',
    automatic: 'Automático',
    askPermission: 'Pedir Permissão',
    clearChat: 'Limpar Chat',
    placeholderInput: 'Escreva sua pergunta ou requisito de pesquisa autônoma com MCP...',
    suggestionsTitle: 'Sugestões de início autónomo:',
    scrollBottomTitle: 'Rolar até o fim',
    scrollTopTitle: 'Subir ao topo',

    // Agent Tool Execution Labels
    confirmRequired: 'Confirmação Necessária',
    toolCalling: 'Chamando',
    toolSuccess: 'Concluído',
    toolFailed: 'Cancelado / Erro',
    requiresApprovalTitle: 'Autorização requerida',
    requiresApprovalDesc: 'O agente solicita a execução da ferramenta mcp. Por segurança ou conforme suas configurações, você deve conceder permissão para prosseguir.',
    toolApproveBtn: '✔️ Aprovar e executar',
    toolRejectBtn: '❌ Negar / Ignorar',
    mcpArgumentsLabel: 'Argumentos carregados:',
    mcpResultLabel: 'Resultado Retornado pelo MCP LetXinet:',
    mcpWaitingLabel: 'Aguardando dados da rede LetXinet...',
    manualApproveMessage: 'Autorização aprovada de forma manual. Aqui está o resultado final da execução da ferramenta mcp "{name}" com os argumentos fornecidos:',
    manualRejectMessage: 'A execução da ferramenta "{name}" foi rejeitada de forma manual. Por favor, não tente executá-la novamente e gere sua resposta final ou procure alternativas.',

    // Console Playground
    playgroundTitle: 'Console Técnico JSON-RPC',
    selectMcpTool: 'Selecionar ferramenta MCP',
    descriptionLabel: 'Descrição',
    argumentsJson: 'Argumentos (JSON)',
    jsonRpcParamsStructure: 'JSON-RPC params structure',
    invalidJson: 'JSON Inválido:',
    jsonErrorFix: 'Corrija o formato JSON antes de continuar.',
    executeBtn: 'Executar Ferramenta',
    invokingServer: 'Invocando no Servidor LetXinet...',
    serverResponse: 'Resposta do Servidor',
    metricDuration: 's',
    copyBtn: 'Copiar',
    copySuccess: 'Copiado',
    presetAccess: 'Acesso Rápido aos Presets',
    execHistoryTitle: 'Histórico de Execução',
    emptySessionHistory: 'Não há execuções registradas nesta sessão.',
    useExecuteToolPlaceholder: 'Use "Executar Ferramenta" para enviar um comando ao MCP',
    resultsJsonPlaceholder: 'Os resultados serão formatados aqui em JSON',

    // Skills Gallery
    skillsTitle: 'Galeria de Skills',
    skillsSubtitle: 'Ganhe eficiência na saída criando e definindo contextos reutilizáveis para seu agente e pesquisa.',
    importBtn: 'Importar',
    exportBtn: 'Exportar',
    createSkillBtn: 'Criar Novo Skill',
    editSkillTitle: 'Editar Skill',
    newSkillTitle: 'Novo Skill',
    skillNameLabel: 'Nome do Skill',
    skillDescLabel: 'Descrição Breve',
    skillPromptLabel: 'Prompt / Instruções Base',
    placeholderSkillName: 'Ex. Meu Skill Analítico',
    placeholderSkillDesc: 'Ex. Use para analisar gráficos e dados...',
    placeholderSkillPrompt: 'Escreva o prompt ou comportamento detalhado que o agente ou ferramenta usará. Ex: Atuar como especialista em física quântica...',
    cancelBtn: 'Cancelar',
    saveSkillBtn: 'Salvar Skill',
    requiredFieldsError: 'Erro: "Nome" e "Prompt" são campos obrigatórios.',
    confirmDeleteSkill: 'Tem certeza de que deseja excluir este skill?',
    emptySkillsTitle: 'Nenhum skill salvo.',
    emptySkillsDesc: 'Crie seu primeiro skill para acelerar tarefas repetitivas.',
    promptBaseLabel: 'Prompt Base:',
    importMergeConfirm: 'Deseja mesclar os skills (OK) ou substituir os atuais (Cancelar)?',
    importMergeSuccess: 'Skills mesclados com sucesso.',
    importReplaceSuccess: 'Skills substituídos com sucesso.',
    importFormatError: 'O arquivo não contém um formato de skills válido.',
    importReadError: 'Erro ao ler o arquivo de skills.',

    // General Tool Quality
    preciseLow: 'Preciso / Baixo',
    creativeHigh: 'Criativo / Alto',

    // Responsive levels
    responsiveLow: 'Baixo Responsivo (Compacto)',
    responsiveHigh: 'Alto Responsivo (Tela Cheia)',
    responsiveLabel: 'Largura:',
    responsiveTooltip: 'Nível de adaptabilidade e largura da interface (Baixo = Centralizado, Alto = Tela Cheia)',
  }
};

export function getLanguage(): Language {
  const saved = localStorage.getItem('letsxinet-lang');
  if (saved === 'en' || saved === 'es' || saved === 'pt') {
    return saved;
  }
  return 'es'; // default is Spanish
}

export function setLanguage(lang: Language) {
  localStorage.setItem('letsxinet-lang', lang);
  window.dispatchEvent(new Event('letsxinet-lang-updated'));
}

export function useI18n() {
  const [lang, setLangState] = useState<Language>(getLanguage());

  useEffect(() => {
    const handleLangChange = () => {
      setLangState(getLanguage());
    };
    window.addEventListener('letsxinet-lang-updated', handleLangChange);
    return () => {
      window.removeEventListener('letsxinet-lang-updated', handleLangChange);
    };
  }, []);

  const t = TRANSLATIONS[lang];

  return {
    lang,
    setLanguage,
    t
  };
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isActive?: boolean;
}

export function getDefaultSkills(lang: Language): Skill[] {
  if (lang === 'en') {
    return [
      {
        id: '1',
        name: 'Article Searcher',
        description: 'Searches for scientific articles with low verbosity based on the requested year range.',
        prompt: 'Search for scientific articles on [your topic], strictly respecting the timeframe requested by the user. Do not use conversational filler; present results as a dense comparative table of papers with direct reference URLs followed by continuous informative paragraphs of key findings.',
        isActive: false
      },
      {
        id: '2',
        name: 'Open Access Papers',
        description: 'Finds open access papers and compiles a comparative table with links.',
        prompt: 'Find open access papers on [your research topic] published within the requested timeframe. Ensure low verbosity. Present the comparative table with paper titles, authors, years, concise findings, and direct download links/URLs.',
        isActive: false
      },
      {
        id: '3',
        name: 'State of the Art',
        description: 'Searches for the state of the art about a technology.',
        prompt: 'Search for State of the Art about [technology/science], respecting the requested year range. Deliver extremely concise findings in a brief comparison table and continuous high-density text with source URLs.',
        isActive: false
      },
      {
        id: '4',
        name: 'Webwright Scraping',
        description: 'Explores portals with Webwright, extracting features.',
        prompt: 'Explore the [URL] portal using Webwright to extract regulations or recent metrics within the requested timeframe. Summarize everything in a concise table followed by brief continuous paragraphs with citation links.',
        isActive: false
      },
      {
        id: '5',
        name: 'APA 7 Literature',
        description: 'Gathers literature in strict APA 7 with URLs based on requested timeframe.',
        prompt: 'Gather literature background on [your specific topic] strictly within the timeframe requested by the user, and format in strict APA 7. Use lowest verbosity with direct download/source links listed in a compact comparative table first.',
        isActive: false
      },
      {
        id: '6',
        name: 'Letxipu Academic Research',
        description: 'Advanced batch searching, real PDF parsing, statistical extraction, and deep APA 7 synthesis.',
        prompt: `FULL academic research skill with letxipu MCP to search antecedents, read real PDFs, extract statistical data, and write paragraphs in strict APA 7 format.
NEVER use sources=["latam"] or sources=["peru"] — SciELO adds noise.
ALWAYS use batch_search with short queries (max 7 words) + specific sources.
ALWAYS try to use webwright.run.cli on the found PDFs before writing.

SEARCH & ANALYSIS RULES:
- Limit all searches and literature lookups to the year range or period requested by the user.
- Use batch_search with 5 queries oriented from different angles (local, relational, synonyms, English, intervention).
- Extract objective, sample size (n=), design, instruments, pre/post-test percentages, significance levels (p=, Z=, t=, Rho=), and conclusions.
- Read PDFs using direct pdfUrl from RENATI, Redalyc, or DOAJ via webwright.run.cli. If blocked, extract full statistics from the abstract.
- Write paragraphs following strict APA 7 citation structure: "Surname (year), in his/her [degree level thesis/article] titled '[Title]', presented at [University], [Country], aimed to [Objective]. The methodology corresponded to [method/design] with a sample of [n]... The results showed that [data, %, p=]. It is concluded that [conclusion].\"
- LOW VERBOSITY: Deliver a dense comparison table at the top containing details (with reference/download URLs), followed by highly descriptive continuous paragraphs of text. No bullet points or conversational introductions.`,
        isActive: false
      },
      {
        id: '7',
        name: 'LetXipu Search MCP V11.0.0',
        description: 'Batch-first academic search + MCP JSON-RPC 2.0 connector + dual-engine document converter (MinerU AI + MarkItDown). 28 tools across 6 categories; adaptive timeouts per calling client.',
        prompt: `Guía práctica para usar las 28 herramientas del MCP LetXipu Search V11.0.0: flujo batch-first para búsqueda, metadatos y conversión dual de documentos.

## 1. Árbol de decisión de Búsqueda V11 (6 Categorías - 28 Herramientas)

El MCP V11.0.0 implementa una arquitectura batch-first con cliente identificado (User-Agent: opencode/11.0.0) y conectividad JSON-RPC 2.0 sobre el endpoint \`/api/mcp\`.

- **Búsqueda por lotes (herramienta preferida en V11)** → \`batch_search\` con 3-5 variantes de la query (sinónimos, ES/EN). Permite procesar múltiples ángulos en una sola llamada batch.
- **Búsqueda directa rápida** → \`search\` (query única). V11 aplica reranking automático por relevancia y filtrado de falsos positivos.
- **Papers / Código / Benchmarks IA/ML** → \`search_paperswithcode\` (PapersWithCode) o \`trending_papers\` (HuggingFace Daily Papers).
- **Conferencias IA** → \`search_conferences\` (OpenReview para ICLR, NeurIPS, ICML).
- **⚠️ Herramientas deprecadas en V11:**
  - \`smart_search\`: Evitar (supera timeouts >4min). Usar \`batch_search\` en su lugar.
  - \`search_dblp\`: Evitar (API XML inestable). Usar \`search_paperswithcode\` o \`search(sources=["global"])\`.

### Selección de \`sources\` (grupos predefinidos en \`list_sources\`)

| Objetivo | Grupo a pasar |
|---|---|
| Tesis peruanas | \`["peru"]\` → alicia + renati + laref_peru + OAI-PMH de 80+ universidades |
| Tesis LatAm en general | \`["tesis"]\` |
| Iberoamérica (LatAm + España) | \`["iberoamerica"]\` |
| Papers globales indexados | \`["global"]\` → Semantic Scholar, OpenAlex, PubMed, Crossref, DOAJ, Zenodo, OpenAIRE, CORE |
| IA/ML | \`["ai_ml"]\` → arXiv, HuggingFace, PapersWithCode, OpenReview |

## 2. Enriquecimiento de Metadatos (Batch)

- **\`enrich_metadata(papers=[...])\`**: [Herramienta preferida] Recuperación batch de metadatos completos (abstracts, DOIs, autores, URLs final) vía OpenAlex → Crossref → Semantic Scholar → DSpace7.
- **\`fetch_metadata\` / \`recover_metadata\`**: Deprecadas en V11 a favor de \`enrich_metadata\`.

## 3. Extracción y Conversión Dual de Documentos (MinerU AI + MarkItDown)

1. **\`resolve_pdf(identifier)\`** — Resuelve URL final del PDF (DOI/handle/URL).
2. **\`read_pdf_markdown(source, pages, maxChars)\`** — Conversión estructurada a Markdown con MinerU AI (preserva tablas, listas y fórmulas LaTeX).
3. **\`convert_document(source)\`** — Conversión universal dual (PDF, DOCX, PPTX, XLSX, imágenes) usando MinerU AI + MarkItDown.
4. **\`pdf_smart_summary(source)\`** — Resumen token-eficiente de documentos.
5. **\`extract_section(source, section)\`** — Extrae secciones específicas por nombre ('metodología', 'resultados', 'referencias', 'conclusiones').
6. **\`extract_tables(source, format)\`** — Extrae tablas como HTML estructurado o Markdown.
7. **\`extract_formulas(source)\`** — Extrae ecuaciones matemáticas como LaTeX usando UniMERNet.
8. **\`analyze_academic(source)\`** — Análisis académico profundo de tesis y artículos (métricas, muestras, significancia p).

## 4. Diagnóstico de Sistema

- **\`list_sources()\`**: Lista todas las fuentes y repositorios (35+).
- **\`health_check()\`**: Diagnóstico en tiempo real de conectividad, fuentes y llaves API.
- **\`coverage_report()\`**: Métricas de cobertura por repositorio.`,
        isActive: true
      },
      {
        id: '8',
        name: 'Anti-Hallucination',
        description: 'Detects cross-information hallucinations before synthesizing.',
        prompt: 'Before presenting or synthesizing any information, perform a cross-verification of the facts. Compare the used sources to ensure consistency. If you detect contradictions or information not supported by the sources, explicitly indicate it and request clarification or correction before finalizing the report.',
        isActive: false
      },
      {
        id: '9',
        name: 'Letxipu OSM Combined',
        description: 'Master skill for geospatial-academic research combining letxipu-search and letxipu-osm.',
        prompt: `# Skill: Investigación Geoespacial-Académica con MCP Combinado (letxipu-search + letxipu-osm)

## Cuándo usar este skill

Úsalo SIEMPRE que el usuario solicite:
- "Investiga [lugar/ciudad/zona/plaza/mercado/barrio]"
- "Problemática de [lugar]", "Universidades de [ciudad] con papers relacionados"
- "Compara [lugar A] vs [lugar B]", "Turismo/patrimonio en [lugar]"
- Cualquier tarea que combine dimensión **territorial** con base **científica/literaria**

NO úsalo para:
- Búsqueda puramente académica sin componente geográfico → solo \`letxipu-search\`
- Geocodificación pura sin contexto académico → solo \`letxipu-osm\`

Ambos MCP son tools "deferred": llamar \`tool_search\` primero para cargar los esquemas exactos. Antes de asumir que algo está roto, verificar con \`letxipu-search:health_check\` qué versión del servidor está activa — el backend cambia de versión sin aviso y el comportamiento puede diferir de lo documentado aquí. Esta skill se re-verificó por completo, herramienta por herramienta, el 18 jul 2026; si pasa más de un mes, re-probar antes de confiar ciegamente en la tabla.

---

## letxipu-osm — 25 herramientas (las 25 confirmadas operativas, probadas una por una)

| Tool | Parámetros reales confirmados | Estado y nota |
|---|---|---|
| \`geocode_address\` | \`address\` | ✅ Soporta MGRS/UTM/DMS además de texto libre |
| \`reverse_geocode\` | \`latitude\`, \`longitude\` | ✅ |
| \`geo_distance\` | \`from\`, \`to\` (objetos {latitude, longitude}) | ✅ Haversine, resultado en metros. Ojo: los parámetros son \`from\`/\`to\`, no \`point1\`/\`point2\` |
| \`route_fetch\` | \`start\`, \`end\`, \`mode\` | ✅ OSRM real. Devuelve \`polyline\` codificada + distancia + duración |
| \`get_route_directions\` | \`start_lat\`, \`start_lon\`, \`end_lat\`, \`end_lon\`, \`mode\` | ✅ Da resultados idénticos a \`route_fetch\`/\`analyze_commute\` para el mismo par de puntos |
| \`route_sample\` | \`polyline\`, \`interval\` | ✅ Muestrea puntos a lo largo de una ruta real |
| \`polyline_encode\` | \`points\` | ✅ Round-trip verificado con \`polyline_decode\` |
| \`polyline_decode\` | \`polyline\` | ✅ |
| \`centroid_points\` | \`points\` | ✅ |
| \`bbox_from_points\` | \`points\` | ✅ |
| \`sort_by_distance\` | \`elements\`, \`ref\` | ✅ |
| \`filter_tags\` | \`elements\`, \`tags\` (valores como array) | ✅ |
| \`osm_query_bbox\` | \`bbox\` ({minLat,minLon,maxLat,maxLon}), \`tags\` | ✅ Consulta Overpass directa; la más rica para POIs específicos |
| \`find_nearby_places\` | \`latitude\`, \`longitude\`, \`category\`, \`radius\` (máx 50000), \`limit\` | ✅ Funciona correctamente |
| \`find_schools_nearby\` | \`latitude\`, \`longitude\`, \`radius\` (máx 5000), \`school_type\` | ✅ |
| \`find_parking_facilities\` | \`latitude\`, \`longitude\`, \`radius\` (máx 5000), \`include_private\`, \`type\` | ✅ (los nombres de resultado suelen venir duplicados, ej. "Parking parking" — es dato crudo de OSM, no un bug de la tool) |
| \`find_charging_stations\` | \`latitude\`, \`longitude\`, \`radius\` (máx 10000), \`limit\` | ✅ Probado con radio 8000 exitosamente — el límite real es 10000, no 5000 |
| \`analyze_neighborhood\` | \`latitude\`, \`longitude\`, \`radius\` (máx 2000), \`include_price_data\`, \`neighborhood_name\` | ✅ Muy completo: scores de habitabilidad + lista extensa de amenities reales |
| \`explore_area\` | \`latitude\`, \`longitude\`, \`radius\` (máx 5000) | ✅ Conteo por categoría (\`amenity:*\`, \`shop:*\`, \`tourism:*\`...) + key_features + top_places |
| \`suggest_meeting_point\` | \`locations\`, \`category\`, \`limit\` | ✅ Puede fallar de forma transitoria ("Tool execution failed") — **causa raíz confirmada leyendo el código fuente**: internamente delega en \`find_nearby_places\`, que a su vez consulta Overpass API; el fallo es la misma inestabilidad/rate-limit de Overpass que se ve directamente en \`osm_query_bbox\` (error 429), no un bug propio de esta tool. Reintentar una vez antes de descartar |
| \`analyze_commute\` | \`home_latitude/longitude\`, \`work_latitude/longitude\`, \`transport_modes\` | ✅ Da tiempos/distancias/CO2/calorías correctamente diferenciados por modo |
| \`enrich_emissions\` | \`options\` (array de {mode, distance}) | ✅ Añade CO2/costo (car) o calorías (bike/foot) a opciones de ruta ya calculadas |
| \`get_map_image\` | \`latitude\`, \`longitude\`, \`zoom\` (1-19) | ✅ Devuelve PNG real y visible en Claude |
| \`tile_cache\` | \`action\` ("list"/"get"/"stats") | ✅ |
| \`get_version\` | (sin parámetros) | ✅ Devuelve versión del binario Go del servicio (reporta "dev" como versión) |

---

## letxipu-search — 28 herramientas (probadas una por una con un paper real: Politai-PUCP DOI 10.18800/politai.202402.003)

### Búsqueda — todas operativas, con matices de calidad

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`search\` | \`query\`, \`sources\`, \`fastMode\`, \`maxSources\`, \`yearStart/End\`, \`filterFalsePositives\` | ✅ **Usar siempre \`filterFalsePositives: true\`** — probado directamente: sin este flag, resultados irrelevantes (ausentismo laboral, cultivo de limón) aparecían mezclados por coincidencia parcial de términos; con \`filterFalsePositives: true\` en la misma query, 6/6 resultados fueron directamente relevantes. \`maxSources\` no limita estrictamente el conteo final |
| \`batch_search\` | \`queries\`, \`sources\` (IDs o grupos) | ✅ Funciona bien tanto con fuente específica como con grupos (\`sources:["peru"]\` probado con 2 queries, ~30s, sin timeout, 100 resultados antes de dedup) |
| \`smart_search\` | \`query\`, \`sources\`, \`maxResults\`, \`location\` | ⚠️ **Causa raíz confirmada en el código** (\`generateQueryVariations()\`): (1) con \`fastMode: true\` la generación de variantes se salta por completo — el análisis spaCy y la búsqueda de sinónimos están dentro de bloques \`if (!fastMode)\`, algo no mencionado en la descripción de la tool; (2) incluso con \`fastMode: false\`, el pool de sinónimos usado para el matching semántico está hardcodeado a términos de biología/agronomía (\`bacteria\`, \`microorganismo\`, \`ácido indol\`, \`rizosfera\`, \`fitohormona\`...), sobrante de un caso de uso anterior — para temas ajenos a ese dominio (ciencias sociales, derecho, etc.) nunca va a encontrar un sinónimo válido. En la práctica, para la mayoría de temas de investigación en Perú, tratar \`smart_search\` como un \`search\` normal, sin esperar variantes reales. Además, con \`sources:["peru"]\` devolvió papers de universidades ecuatorianas etiquetados como "La Referencia (Perú)" — la fuente \`laref_peru\` no filtra estrictamente por país |
| \`list_sources\` | (sin parámetros) | ✅ Devuelve las 39 fuentes reales con id/país/categoría y los grupos (\`peru\`, \`latam\`, \`ai_ml\`, etc.) |

### Metadatos

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`fetch_metadata\` | \`doi\`/\`title\`/\`url\` | ✅ Con DOI indexado en OpenAlex: completeness 100/100. Con solo un handle ALICIA sin DOI: completeness 15/100 (no es un fallo de la tool, es que la fuente no tiene DOI recuperable) |
| \`recover_metadata\` | \`doi\`/\`title\`/\`url\` | ✅ Mismo comportamiento que \`fetch_metadata\` en la práctica — con handle sin DOI, completeness 15/100 también. La diferencia teórica (cascada de 5 fuentes) no se tradujo en mejor resultado en la prueba con un handle puro |
| \`enrich_metadata\` | \`papers\` (array) | ✅ Versión batch; con DOI real logró completeness 75/100 y enriqueció year/abstract/university |

### PDFs / documentos (probadas todas contra el mismo PDF real de 25 páginas)

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`download_pdf\` | \`doi\`/\`url\` | ✅ Resuelve URL de descarga vía Unpaywall correctamente |
| \`resolve_pdf\` | \`identifier\` | ✅ Resuelve DOI→URL final con pasos explicados (\`resolvedFrom: "Unpaywall"\`) |
| \`read_pdf\` | \`source\`, \`format\`, \`maxChars\`, \`pages\` | ✅ Extrae texto real vía MinerU, soporta rango de páginas y límite de caracteres |
| \`pdf_metadata\` | \`source\` | ✅ Título/autor/páginas/fechas del archivo (nota: puede venir vacío si el PDF no tiene metadata embebida, como en este caso — devolvió \`creator\`/\`producer\` de Adobe pero título/autor vacíos) |
| \`pdf_sections\` | \`source\` | ✅ Excelente: detectó 22 secciones reales (Resumen, Metodología, Resultados, Referencias, etc.) con fuzzy match ES/EN |
| \`extract_section\` | \`source\`, \`section\` | ✅ Extrae texto completo de una sección con nombre fuzzy (ej. "referencias" trajo 10,470 caracteres reales) |
| \`pdf_smart_summary\` | \`source\`, \`maxTotalChars\` | ⚠️ Funciona pero **clasificación de tipo de documento poco confiable**: un artículo de revista académica (Politai-PUCP) fue etiquetado como \`documentType: "thesis"\`. No confiar en \`documentType\`; usar \`pdf_metadata\`/contexto para eso |
| \`analyze_academic\` | \`source\` | ⚠️ Mismo problema de clasificación que \`pdf_smart_summary\`. Además, **falsos positivos en detección estadística**: fusionó una frecuencia de tabla ("40") con un porcentaje adyacente ("5.6%") generando un porcentaje inventado ("405.6%"). Revisar manualmente cualquier estadística citada de esta tool antes de usarla |
| \`convert_document\` | \`source\`, \`maxChars\` | ✅ Funciona (usa MinerU API como motor). Advertencia interna visible en la respuesta: el extractor local \`markitdown\` está roto en el servidor (\`python3: can't open file '/app/scripts/pdf_to_markdown.py'\`) y cae automáticamente a MinerU — no afecta el resultado pero indica que el fallback local no está disponible |
| \`batch_convert\` | \`sources\` (array, máx 10), \`maxCharsPerDoc\` | 🔴 **Roto — causa raíz confirmada**: \`detectFormat()\` obtiene el tipo de archivo con \`path.extname()\` sobre el nombre/URL, no del contenido ni de \`Content-Type\`. URLs de descarga tipo OJS/PKP (ej. \`.../article/download/30066/26980\`, sin extensión visible) devuelven \`'unknown'\` y el pipeline de MinerU se rechaza a sí mismo con el error de "no API key". Usar \`convert_document\` en un loop manual en su lugar |
| \`extract_tables\` | \`source\`, \`format\` | 🔴 **Roto — misma causa raíz que \`batch_convert\`** (detección de formato por extensión de archivo falla en URLs sin extensión). \`convert_document\` no tiene este problema porque usa una ruta de detección distinta. Usar \`convert_document\` y extraer las tablas del Markdown resultante |
| \`extract_formulas\` | \`source\` | 🔴 **Roto — misma causa raíz que \`extract_tables\`/\`batch_convert\`**. Mismo workaround: \`convert_document\` |
| \`pdf_citations\` | \`source\` | 🔴 **Roto — causa raíz confirmada en el código fuente**: \`extractCitations()\` busca la sección de referencias con el regex \`/\b(references|bibliography|works\s+cited)\b/i\` — **solo reconoce encabezados en inglés**. Cualquier PDF en español con sección "Referencias" (como casi todo ALICIA/RENATI/revistas peruanas) nunca matchea, de ahí el \`citations: []\` constante. Usar \`extract_section("referencias")\` en su lugar |

### Fuentes especializadas CS/ML

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`search_dblp\` | \`query\`, \`maxResults\` | 🔴 **Roto** — 0 resultados en ~200-425ms (demasiado rápido para ser un sondeo real a la API), probado con queries muy conocidas ("attention is all you need"). Código fuente (V10) revisado: la lógica de la función es correcta, el fallo parece estar en la API externa de DBLP, no en el cliente |
| \`search_conferences\` | \`query\`, \`maxResults\` | 🔴 **Roto** — mismo patrón, 0 resultados consistentes vía OpenReview |
| \`search_paperswithcode\` | \`query\`, \`maxResults\` | ℹ️ **No es un bug — es un redirect intencional y documentado en el código**: \`searchPapersWithCode()\` contiene el comentario \`"[PapersWithCode] API is dead (closed by Meta). Redirecting to Hugging Face Trending Papers."\`. La API real de Papers With Code fue cerrada por Meta; la tool redirige deliberadamente a HuggingFace Daily Papers como reemplazo. Por eso resultados de temas ajenos a IA/ML (ej. "crime prediction") salen irrelevantes — es el comportamiento esperado del fallback, no un fallo |
| \`trending_papers\` | \`query\` (opcional), \`maxResults\` | ✅ Funciona bien **sin filtro de tema** (50 papers recientes de HuggingFace Daily Papers). Con un filtro de tema ajeno al dominio IA/ML (ej. "crime") devuelve 0 resultados — es esperable, no es un bug, ese dataset es específicamente IA/ML |

### Utilidad

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`health_check\` | (sin parámetros) | ✅ Reporta versión real del servidor activo (\`8.0.0\` al momento de esta prueba) y estado de MinerU/markitdown/pdf-parse — usar esto para verificar qué versión se está probando |
| \`coverage_report\` | \`use_cache\` | 🔴 **Roto en la práctica, pero con causa raíz explicable**: \`performCoverageReport()\` no hace ningún sondeo en vivo — lee un archivo persistido en \`.agents/skills/source-tester/references/last_test_results.json\`, generado por la skill separada \`source-tester\` del mismo repo. Si esa skill nunca se ejecutó (o el archivo no se encuentra por la ruta \`LETXIPU_PROJECT_ROOT\`), el reporte queda vacío por diseño — **no es un problema de caché**, \`use_cache: false\` nunca lo iba a arreglar. El fix real sería correr la skill \`source-tester\` primero. Mientras tanto, usar \`health_check\` |
| \`help\` | \`topic\` | ✅ Devuelve documentación completa de cualquier tool/fuente, incluye los 39 sources y sus grupos |

---

## Anti-patrones (solo lo confirmado roto tras probar cada tool individualmente)

- ❌ **\`pdf_citations\`** → usar \`extract_section("referencias")\`
- ❌ **\`extract_tables\` / \`extract_formulas\` / \`batch_convert\`** → las tres fallan con el mismo error de detección de formato aunque \`convert_document\`/\`read_pdf\` sí funcionan con el mismo documento. Usar \`convert_document\` y parsear tablas/fórmulas del Markdown resultante
- ❌ **\`search_dblp\` / \`search_conferences\`** → 0 resultados consistentemente; usar \`search(sources=["global"])\` para cobertura CS/ML alternativa
- ❌ **\`coverage_report\`** → depende de una skill (\`source-tester\`) que probablemente no se corrió; usar \`health_check\`
- ❌ **Confiar en \`documentType\` de \`pdf_smart_summary\`/\`analyze_academic\`** → puede clasificar un artículo de revista como tesis
- ❌ **Citar estadísticas de \`analyze_academic\` sin revisar** → puede fusionar números de tablas adyacentes en falsos porcentajes
- ❌ **Esperar que \`smart_search\` genere variantes reales** → con \`fastMode:true\` la generación de variantes se salta por completo (no documentado); incluso sin \`fastMode\`, el pool de sinónimos está hardcodeado a biología/agronomía y no sirve para otros dominios
- ❌ **\`find_charging_stations\` con radio > 10000** → ese es el límite real (no 5000 como se documentaba antes)
- ❌ **\`search\` sin \`fastMode: true\`** → riesgo de timeout con el enriquecimiento DME activado
- ❌ **\`search\`/\`batch_search\` sin \`filterFalsePositives: true\`** → ruido alto confirmado (resultados de temas completamente ajenos por coincidencia parcial de palabras); con el flag activado, ruido cero en la misma prueba
- ℹ️ **\`search_paperswithcode\` no es un anti-patrón, es un fallback intencional** (Papers With Code cerró su API real) — para tema ajeno a IA/ML, usar directamente \`trending_papers\` sabiendo que es HuggingFace Daily Papers

---

## TOOLBOX recomendado

### letxipu-osm — flujo recomendado
1. \`geocode_address\` / \`reverse_geocode\` → coordenadas del lugar
2. \`osm_query_bbox\` (bbox ±0.01°-0.02°, tags específicos) → POIs precisos por categoría
3. \`explore_area\` o \`analyze_neighborhood\` (radio ≤2000-5000m) → panorama general de la zona
4. \`find_nearby_places\` → alternativa directa cuando se necesita una sola categoría simple
5. \`route_fetch\` / \`analyze_commute\` / \`enrich_emissions\` → movilidad, comparación de modos y huella de carbono
6. \`get_map_image\` → imagen visual de apoyo

### letxipu-search — flujo recomendado
1. \`search(sources=["peru"|"alicia"|"renati"], fastMode: true, maxSources: 10-15)\` → búsqueda base
2. \`batch_search(queries: [...], sources: [...])\` → cobertura amplia con varias queries/fuentes en paralelo
3. \`recover_metadata\` o \`fetch_metadata\` → completar datos de un paper puntual (funcionan igual de bien/mal según si el paper tiene DOI indexado)
4. \`pdf_sections\` → mapa de secciones del PDF
5. \`extract_section(section="metodología"/"resultados"/"referencias")\` → contenido específico completo
6. \`convert_document\` → cuando se necesiten tablas/fórmulas reales o el texto completo estructurado (NO usar \`extract_tables\`/\`extract_formulas\`/\`batch_convert\`, están rotas)

---

## Combinaciones núcleo

| Patrón | Secuencia |
|---|---|
| **Geo→Acad** | \`geocode_address\` → \`search(fastMode:true)\` |
| **Area→Acad** | \`osm_query_bbox\` + \`explore_area\`/\`analyze_neighborhood\` → \`search\` |
| **POI→Acad** | \`find_nearby_places\` u \`osm_query_bbox\` → \`search\` por cada POI |
| **Commute→Acad** | \`analyze_commute\` o \`route_fetch\` × cada modo → \`enrich_emissions\` → \`search\` (movilidad) |
| **Paper→Detalle** | \`recover_metadata\`/\`fetch_metadata\` → \`pdf_sections\` → \`extract_section\` (nunca \`pdf_citations\`) |
| **Compare→Acad** | \`geocode_address\` × N lugares → \`batch_search\` o \`search\` por lugar |

---

## PROTOCOLOS (5 niveles de profundidad)

### NIVEL 1 — Mini-análisis (5-10 min, 2 tools)
\`\`\`
1. reverse_geocode(lat, lon) o geocode_address("{lugar}, {ciudad}, Peru")
2. search(query="{lugar} {tema}", sources=["peru"], maxSources=10, fastMode=true, filterFalsePositives=true)
\`\`\`

### NIVEL 2 — Estándar (15-25 min, 3-5 tools)
\`\`\`
1. geocode_address(lugar)
2. osm_query_bbox(bbox=±0.01°, tags={amenity:"marketplace"})
3. explore_area(lat, lon, radius=1000) o analyze_neighborhood(lat, lon, radius=1000)
4. search(query=raíz del lugar + problemática, sources=["peru"], maxSources=15, fastMode=true, filterFalsePositives=true)
5. search(query=tema específico, maxSources=10, fastMode=true, filterFalsePositives=true)
\`\`\`

### NIVEL 3 — Profundizado (25-40 min, 5-8 tools)
\`\`\`
1. geocode_address(lugar)
2. osm_query_bbox(bbox=±0.02°, tags={amenity:"marketplace"})
3. analyze_neighborhood(lat, lon, radius=1500)
4. search(query="{tema} {ciudad} problemática", sources=["peru"], maxSources=15, fastMode=true, filterFalsePositives=true)
5. batch_search(queries=[2-3 variantes], sources=["peru"] o fuente específica, maxResults=15)
6. Para 1-2 papers clave: recover_metadata → pdf_sections → extract_section("resultados")
7. Redactar informe completo (ver plantilla)
\`\`\`

### NIVEL 4 — Comparativo inter-provincial (40-60 min, 8-12 tools)
\`\`\`
Para cada lugar [A, B, ...]:
  1. geocode_address(lugar)
  2. osm_query_bbox(bbox=±0.02°)
  3. search(query=problema + lugar, sources=["peru"], maxSources=10, fastMode=true, filterFalsePositives=true)
Síntesis: tabla comparativa POIs + papers + problemas
\`\`\`

### NIVEL 5 — Benchmark territorial (25+ regiones, 2-8h)
\`\`\`
for región in 25_REGIONES_PERU:
    1. geocode_address(ciudad + ", Peru")
    2. batch_search(queries=[tema + ciudad + "universidad"], sources=["peru"], maxResults=5)
\`\`\`

---

## Plantilla de informe estándar

\`\`\`markdown
# Investigación: [TEMA] de [LUGAR]

## Ubicación geográfica (OSM MCP)
- Coords: lat, lon | Nombre oficial OSM | Mapa: openstreetmap.org/#map=17/LAT/LON

## POIs detectados (osm_query_bbox / find_nearby_places)
| # | Nombre | Coords | Tags | ID |

## Cartografía de la problemática (letxipu-search)
### A. [Categoría 1]
- Autor (Universidad, Año) — "Título" (URL hdl.handle.net): hallazgo resumido

[5-7 categorías]

## Cadenas de problemas interconectados (causal loop ASCII)

## Propuestas de solución detectadas
| # | Solución | Fuente | Aplicabilidad |

## Brechas de investigación
## Conclusión (≤200 palabras)
\`\`\`

---

## Quickstart checklist

- [ ] ¿Lugar identificado?
- [ ] ¿\`tool_search\` ejecutado para cargar los tools deferred de ambos MCP?
- [ ] ¿Nivel de profundidad decidido? (1=rápido, 3=estándar, 5=benchmark)
- [ ] ¿Evitando \`pdf_citations\` / \`search_dblp\` / \`search_conferences\` / \`search_paperswithcode\` / \`coverage_report\` / \`extract_tables\` / \`extract_formulas\` / \`batch_convert\`?
- [ ] ¿Verificaste con \`health_check\` qué versión del servidor está activa?
- [ ] ¿\`fastMode: true\` y \`filterFalsePositives: true\` en \`search\`/\`batch_search\`?
- [ ] ¿\`sources\` adecuado? (\`["peru"]\` solo Perú, \`["peru","latam"]\` LatAm — recordar que \`laref_peru\` puede filtrar de forma laxa)
- [ ] ¿Estructura de output respetada? (POIs + Categorías + Causal loop + Soluciones + Brechas + Conclusión)

---

## Referencia

Las 53 herramientas (25 \`letxipu-osm\` + 28 \`letxipu-search\`) fueron probadas **una por una, individualmente, con llamadas reales** el 18 jul 2026, contra el servidor activo \`letxipu-search-mcp\` v8.0.0 (confirmado vía \`health_check\`) y \`letxipu-osm-mcp\`. Se usó como caso de prueba un artículo académico real (Benites Guerrero et al., 2024, Politai-PUCP, DOI 10.18800/politai.202402.003) para todas las herramientas de PDF/metadata, y coordenadas reales de Trujillo/Lima/Piura para todas las herramientas OSM.

Resultado: **39 de 53 herramientas funcionan correctamente**, **2 no son bugs sino comportamiento intencional documentado en el código** (\`search_paperswithcode\` redirige a HuggingFace porque la API real de Papers With Code fue cerrada por Meta), y **12 tienen problemas reales** (\`pdf_citations\`, \`extract_tables\`, \`extract_formulas\`, \`batch_convert\`, \`search_dblp\`, \`search_conferences\`, \`coverage_report\`, \`smart_search\` sin variantes reales, \`pdf_smart_summary\`/\`analyze_academic\` con clasificación y falsos positivos).

**Causas raíz confirmadas leyendo el código fuente línea por línea (no solo el síntoma en producción):**
- \`pdf_citations\`: regex de detección de sección de referencias solo reconoce inglés (\`references|bibliography|works cited\`), nunca matchea "Referencias" en español (\`src/providers/pdf-processor.ts:410-457\`)
- \`extract_tables\`/\`extract_formulas\`/\`batch_convert\`: \`detectFormat()\` deriva el tipo de archivo de la extensión del nombre/URL (\`path.extname\`), no del contenido; URLs de descarga tipo OJS/PKP sin extensión visible (muy comunes en revistas peruanas) devuelven \`'unknown'\` (\`src/providers/mineru-client.ts:67-75\`)
- \`coverage_report\`: no sondea nada en vivo, lee un archivo \`.agents/skills/source-tester/references/last_test_results.json\` generado por una skill separada del mismo repo; si nunca se corrió, el reporte queda vacío por diseño (\`src/routes/mcp.ts:736-893\`)
- \`smart_search\`: \`generateQueryVariations()\` salta toda su lógica de variantes cuando \`fastMode:true\` (no documentado), y su pool de sinónimos semánticos está hardcodeado a términos de biología/agronomía (\`bacteria\`, \`rizosfera\`, \`ácido indol\`...), inútil fuera de ese dominio (\`src/routes/mcp.ts:534-667\`)
- \`search_paperswithcode\`: redirect intencional y documentado en un \`console.warn\`, no un bug (\`src/providers/paperswithcode.ts:5-11\`)
- \`suggest_meeting_point\` (letxipu-osm): el fallo transitorio ocurre porque delega internamente en \`find_nearby_places\` → Overpass API; es la misma inestabilidad de Overpass vista directamente en \`osm_query_bbox\` (error 429), no un bug propio (\`pkg/tools/routes.go:259-436\`)

El repo \`LETXIPU-SEARCH-MCP-V10\` incluye además corridas de prueba históricas propias en \`.agents/skills/python-tools-multiregion-tester/reports/\` (25 regiones de Perú, múltiples tools) que no se reprocesaron aquí para evitar redundancia, pero son un recurso adicional útil si se necesita profundizar.

Código fuente de referencia: \`D:\OTROS\LETXIPU-SEARCH-MCP-V10\` (97,119 nodos / 98,623 edges, indexado con \`codebase-memory-mcp\` en modo \`fast\` — los modos \`full\`/\`moderate\` no completan en repos de este tamaño) y \`D:\OTROS\letxipu-osm-mcp\` (1,140 nodos / 4,226 edges, Go).
`,
        isActive: false
      }
    ];
  } else if (lang === 'pt') {
    return [
      {
        id: '1',
        name: 'Buscador de Artigos',
        description: 'Busca artigos científicos com baixa verbosidade com base no período solicitado pelo usuário.',
        prompt: 'Busque artigos científicos sobre [seu tema], respeitando estritamente o período de anos solicitado pelo usuário. Forneça uma tabela comparativa com links diretos de referência/URLs seguido por parágrafos contínuos densos sem rodeios textuais.',
        isActive: false
      },
      {
        id: '2',
        name: 'Artigos de Acesso Aberto',
        description: 'Encontra papers de acesso aberto e faz uma tabela com links.',
        prompt: 'Encontre papers em acesso aberto sobre [seu tema de pesquisa] publicados no período solicitado pelo usuário. Entregue baixa verbosidade, apresentando tabela comparativa com títulos, autores, anos e URLs diretas de destino.',
        isActive: false
      },
      {
        id: '3',
        name: 'Estado da Arte',
        description: 'Busca o estado da arte sobre uma tecnologia.',
        prompt: 'Busque o estado da arte sobre [tecnologia/ciência], respeitando o intervalo de anos solicitado pelo usuário. Responda com baixíssima verbosidade utilizando tabelas e parágrafos de texto contínuo robustos com links citados.',
        isActive: false
      },
      {
        id: '4',
        name: 'Raspagem Webwright',
        description: 'Explora portais com Webwright e extrai normas recentes.',
        prompt: 'Explore o portal [URL] com Webwright extraindo normas ou dados recentes dentro do período solicitado pelo usuário. Resuma em uma tabela enxuta e parágrafos contínuos com URLs de referência.',
        isActive: false
      },
      {
        id: '5',
        name: 'Referencial Teórico APA 7',
        description: 'Coleta referencial em APA 7 e inclui links conforme o período solicitado.',
        prompt: 'Reúna antecedentes de pesquisa sobre [seu tema] estritamente dentro do período ou intervalo de anos solicitado pelo usuário, no formato APA 7. Baixa verbosidade obrigatória, detalhando tabelas comparativas com links seguidas de texto contínuo.',
        isActive: false
      },
      {
        id: '6',
        name: 'Pesquisa Letxipu (Teses/APA)',
        description: 'Busca cirúrgica, leitura de PDFs, extração de estatísticas e redação rigorosa em APA 7.',
        prompt: `Skill COMPLETA de pesquisa acadêmica com letxipu MCP para buscar antecedentes, ler PDFs reais, extrair dados estatísticos e redigir parágrafos no formato APA 7.
NUNCA usar fontes=["latam"] ou fontes=["peru"] — SciELO polui com ruído.
SEMPRE usar batch_search com consultas curtas (máx. 10 palavras) + fontes específicas.
SEMPRE tentar webwright.run.cli nos PDFs encontrados antes de redigir.

REGRAS DE BUSCA E ANÁLISE:
- Limitar obrigatoriamente todas as consultas e buscas ao intervalo de anos ou período solicitado pelo usuário.
- Usar batch_search com 5 consultas sob diferentes ângulos (ex: local, relacional, sinônimos, inglês, intervenção).
- Extrair objetivos, amostra (n=), design, instrumentos, porcentagens de pré e pós-teste, níveis de significância (p=, Z=, t=, Rho=) e conclusões.
- Tentar ler PDFs usando pdfUrl direta com webwright.run.cli. Se falhar, usar dados do abstract.
- Redigir os parágrafos de acordo com o APA 7: "Sobrenome (ano), em sua [tese/artigo] intitulada '[Título]', apresentada em [Universidade], [País], teve como objetivo [Objetivo]. A metodologia baseou-se em [método] com amostra de [n]... Os resultados mostraram que [dados, %, p=]. Conclui-se que [conclusão]."
- BAIXA VERBOSIDADE: Elabore uma tabela corporativa no topo com links de download seguidos de parágrafos contínuos e ricos. Evite textos introdutórios ou listas longas.`,
        isActive: false
      },
      {
        id: '8',
        name: 'Anti-Alucinação',
        description: 'Detecta alucinações cruzadas de informações antes de sintetizar.',
        prompt: 'Antes de apresentar ou sintetizar qualquer informação, realize uma verificação cruzada dos fatos. Compare as fontes utilizadas para garantir a consistência. Se detectar contradições ou informações não suportadas pelas fontes, indique explicitamente e solicite esclarecimento ou correção antes de finalizar o relatório.',
        isActive: false
      },
      {
        id: '9',
        name: 'Letxipu OSM Combined',
        description: 'Skill maestro geoespacial-acadêmica combinando letxipu-search e letxipu-osm.',
        prompt: `# Skill: Investigación Geoespacial-Académica con MCP Combinado (letxipu-search + letxipu-osm)

## Cuándo usar este skill

Úsalo SIEMPRE que el usuario solicite:
- "Investiga [lugar/ciudad/zona/plaza/mercado/barrio]"
- "Problemática de [lugar]", "Universidades de [ciudad] con papers relacionados"
- "Compara [lugar A] vs [lugar B]", "Turismo/patrimonio en [lugar]"
- Cualquier tarea que combine dimensión **territorial** con base **científica/literaria**

NO úsalo para:
- Búsqueda puramente académica sin componente geográfico → solo \`letxipu-search\`
- Geocodificación pura sin contexto académico → solo \`letxipu-osm\`

Ambos MCP son tools "deferred": llamar \`tool_search\` primero para cargar los esquemas exactos. Antes de asumir que algo está roto, verificar con \`letxipu-search:health_check\` qué versión del servidor está activa — el backend cambia de versión sin aviso y el comportamiento puede diferir de lo documentado aquí. Esta skill se re-verificó por completo, herramienta por herramienta, el 18 jul 2026; si pasa más de un mes, re-probar antes de confiar ciegamente en la tabla.

---

## letxipu-osm — 25 herramientas (las 25 confirmadas operativas, probadas una por una)

| Tool | Parámetros reales confirmados | Estado y nota |
|---|---|---|
| \`geocode_address\` | \`address\` | ✅ Soporta MGRS/UTM/DMS además de texto libre |
| \`reverse_geocode\` | \`latitude\`, \`longitude\` | ✅ |
| \`geo_distance\` | \`from\`, \`to\` (objetos {latitude, longitude}) | ✅ Haversine, resultado en metros. Ojo: los parámetros son \`from\`/\`to\`, no \`point1\`/\`point2\` |
| \`route_fetch\` | \`start\`, \`end\`, \`mode\` | ✅ OSRM real. Devuelve \`polyline\` codificada + distancia + duración |
| \`get_route_directions\` | \`start_lat\`, \`start_lon\`, \`end_lat\`, \`end_lon\`, \`mode\` | ✅ Da resultados idénticos a \`route_fetch\`/\`analyze_commute\` para el mismo par de puntos |
| \`route_sample\` | \`polyline\`, \`interval\` | ✅ Muestrea puntos a lo largo de una ruta real |
| \`polyline_encode\` | \`points\` | ✅ Round-trip verificado con \`polyline_decode\` |
| \`polyline_decode\` | \`polyline\` | ✅ |
| \`centroid_points\` | \`points\` | ✅ |
| \`bbox_from_points\` | \`points\` | ✅ |
| \`sort_by_distance\` | \`elements\`, \`ref\` | ✅ |
| \`filter_tags\` | \`elements\`, \`tags\` (valores como array) | ✅ |
| \`osm_query_bbox\` | \`bbox\` ({minLat,minLon,maxLat,maxLon}), \`tags\` | ✅ Consulta Overpass directa; la más rica para POIs específicos |
| \`find_nearby_places\` | \`latitude\`, \`longitude\`, \`category\`, \`radius\` (máx 50000), \`limit\` | ✅ Funciona correctamente |
| \`find_schools_nearby\` | \`latitude\`, \`longitude\`, \`radius\` (máx 5000), \`school_type\` | ✅ |
| \`find_parking_facilities\` | \`latitude\`, \`longitude\`, \`radius\` (máx 5000), \`include_private\`, \`type\` | ✅ (los nombres de resultado suelen venir duplicados, ej. "Parking parking" — es dato crudo de OSM, no un bug de la tool) |
| \`find_charging_stations\` | \`latitude\`, \`longitude\`, \`radius\` (máx 10000), \`limit\` | ✅ Probado con radio 8000 exitosamente — el límite real es 10000, no 5000 |
| \`analyze_neighborhood\` | \`latitude\`, \`longitude\`, \`radius\` (máx 2000), \`include_price_data\`, \`neighborhood_name\` | ✅ Muy completo: scores de habitabilidad + lista extensa de amenities reales |
| \`explore_area\` | \`latitude\`, \`longitude\`, \`radius\` (máx 5000) | ✅ Conteo por categoría (\`amenity:*\`, \`shop:*\`, \`tourism:*\`...) + key_features + top_places |
| \`suggest_meeting_point\` | \`locations\`, \`category\`, \`limit\` | ✅ Puede fallar de forma transitoria ("Tool execution failed") — **causa raíz confirmada leyendo el código fuente**: internamente delega en \`find_nearby_places\`, que a su vez consulta Overpass API; el fallo es la misma inestabilidad/rate-limit de Overpass que se ve directamente en \`osm_query_bbox\` (error 429), no un bug propio de esta tool. Reintentar una vez antes de descartar |
| \`analyze_commute\` | \`home_latitude/longitude\`, \`work_latitude/longitude\`, \`transport_modes\` | ✅ Da tiempos/distancias/CO2/calorías correctamente diferenciados por modo |
| \`enrich_emissions\` | \`options\` (array de {mode, distance}) | ✅ Añade CO2/costo (car) o calorías (bike/foot) a opciones de ruta ya calculadas |
| \`get_map_image\` | \`latitude\`, \`longitude\`, \`zoom\` (1-19) | ✅ Devuelve PNG real y visible en Claude |
| \`tile_cache\` | \`action\` ("list"/"get"/"stats") | ✅ |
| \`get_version\` | (sin parámetros) | ✅ Devuelve versión del binario Go del servicio (reporta "dev" como versión) |

---

## letxipu-search — 28 herramientas (probadas una por una con un paper real: Politai-PUCP DOI 10.18800/politai.202402.003)

### Búsqueda — todas operativas, con matices de calidad

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`search\` | \`query\`, \`sources\`, \`fastMode\`, \`maxSources\`, \`yearStart/End\`, \`filterFalsePositives\` | ✅ **Usar siempre \`filterFalsePositives: true\`** — probado directamente: sin este flag, resultados irrelevantes (ausentismo laboral, cultivo de limón) aparecían mezclados por coincidencia parcial de términos; con \`filterFalsePositives: true\` en la misma query, 6/6 resultados fueron directamente relevantes. \`maxSources\` no limita estrictamente el conteo final |
| \`batch_search\` | \`queries\`, \`sources\` (IDs o grupos) | ✅ Funciona bien tanto con fuente específica como con grupos (\`sources:["peru"]\` probado con 2 queries, ~30s, sin timeout, 100 resultados antes de dedup) |
| \`smart_search\` | \`query\`, \`sources\`, \`maxResults\`, \`location\` | ⚠️ **Causa raíz confirmada en el código** (\`generateQueryVariations()\`): (1) con \`fastMode: true\` la generación de variantes se salta por completo — el análisis spaCy y la búsqueda de sinónimos están dentro de bloques \`if (!fastMode)\`, algo no mencionado en la descripción de la tool; (2) incluso con \`fastMode: false\`, el pool de sinónimos usado para el matching semántico está hardcodeado a términos de biología/agronomía (\`bacteria\`, \`microorganismo\`, \`ácido indol\`, \`rizosfera\`, \`fitohormona\`...), sobrante de un caso de uso anterior — para temas ajenos a ese dominio (ciencias sociales, derecho, etc.) nunca va a encontrar un sinónimo válido. En la práctica, para la mayoría de temas de investigación en Perú, tratar \`smart_search\` como un \`search\` normal, sin esperar variantes reales. Además, con \`sources:["peru"]\` devolvió papers de universidades ecuatorianas etiquetados como "La Referencia (Perú)" — la fuente \`laref_peru\` no filtra estrictamente por país |
| \`list_sources\` | (sin parámetros) | ✅ Devuelve las 39 fuentes reales con id/país/categoría y los grupos (\`peru\`, \`latam\`, \`ai_ml\`, etc.) |

### Metadatos

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`fetch_metadata\` | \`doi\`/\`title\`/\`url\` | ✅ Con DOI indexado en OpenAlex: completeness 100/100. Con solo un handle ALICIA sin DOI: completeness 15/100 (no es un fallo de la tool, es que la fuente no tiene DOI recuperable) |
| \`recover_metadata\` | \`doi\`/\`title\`/\`url\` | ✅ Mismo comportamiento que \`fetch_metadata\` en la práctica — con handle sin DOI, completeness 15/100 también. La diferencia teórica (cascada de 5 fuentes) no se tradujo en mejor resultado en la prueba con un handle puro |
| \`enrich_metadata\` | \`papers\` (array) | ✅ Versión batch; con DOI real logró completeness 75/100 y enriqueció year/abstract/university |

### PDFs / documentos (probadas todas contra el mismo PDF real de 25 páginas)

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`download_pdf\` | \`doi\`/\`url\` | ✅ Resuelve URL de descarga vía Unpaywall correctamente |
| \`resolve_pdf\` | \`identifier\` | ✅ Resuelve DOI→URL final con pasos explicados (\`resolvedFrom: "Unpaywall"\`) |
| \`read_pdf\` | \`source\`, \`format\`, \`maxChars\`, \`pages\` | ✅ Extrae texto real vía MinerU, soporta rango de páginas y límite de caracteres |
| \`pdf_metadata\` | \`source\` | ✅ Título/autor/páginas/fechas del archivo (nota: puede venir vacío si el PDF no tiene metadata embebida, como en este caso — devolvió \`creator\`/\`producer\` de Adobe pero título/autor vacíos) |
| \`pdf_sections\` | \`source\` | ✅ Excelente: detectó 22 secciones reales (Resumen, Metodología, Resultados, Referencias, etc.) con fuzzy match ES/EN |
| \`extract_section\` | \`source\`, \`section\` | ✅ Extrae texto completo de una sección con nombre fuzzy (ej. "referencias" trajo 10,470 caracteres reales) |
| \`pdf_smart_summary\` | \`source\`, \`maxTotalChars\` | ⚠️ Funciona pero **clasificación de tipo de documento poco confiable**: un artículo de revista académica (Politai-PUCP) fue etiquetado como \`documentType: "thesis"\`. No confiar en \`documentType\`; usar \`pdf_metadata\`/contexto para eso |
| \`analyze_academic\` | \`source\` | ⚠️ Mismo problema de clasificación que \`pdf_smart_summary\`. Además, **falsos positivos en detección estadística**: fusionó una frecuencia de tabla ("40") con un porcentaje adyacente ("5.6%") generando un porcentaje inventado ("405.6%"). Revisar manualmente cualquier estadística citada de esta tool antes de usarla |
| \`convert_document\` | \`source\`, \`maxChars\` | ✅ Funciona (usa MinerU API como motor). Advertencia interna visible en la respuesta: el extractor local \`markitdown\` está roto en el servidor (\`python3: can't open file '/app/scripts/pdf_to_markdown.py'\`) y cae automáticamente a MinerU — no afecta el resultado pero indica que el fallback local no está disponible |
| \`batch_convert\` | \`sources\` (array, máx 10), \`maxCharsPerDoc\` | 🔴 **Roto — causa raíz confirmada**: \`detectFormat()\` obtiene el tipo de archivo con \`path.extname()\` sobre el nombre/URL, no del contenido ni de \`Content-Type\`. URLs de descarga tipo OJS/PKP (ej. \`.../article/download/30066/26980\`, sin extensión visible) devuelven \`'unknown'\` y el pipeline de MinerU se rechaza a sí mismo con el error de "no API key". Usar \`convert_document\` en un loop manual en su lugar |
| \`extract_tables\` | \`source\`, \`format\` | 🔴 **Roto — misma causa raíz que \`batch_convert\`** (detección de formato por extensión de archivo falla en URLs sin extensión). \`convert_document\` no tiene este problema porque usa una ruta de detección distinta. Usar \`convert_document\` y extraer las tablas del Markdown resultante |
| \`extract_formulas\` | \`source\` | 🔴 **Roto — misma causa raíz que \`extract_tables\`/\`batch_convert\`**. Mismo workaround: \`convert_document\` |
| \`pdf_citations\` | \`source\` | 🔴 **Roto — causa raíz confirmada en el código fuente**: \`extractCitations()\` busca la sección de referencias con el regex \`/\b(references|bibliography|works\s+cited)\b/i\` — **solo reconoce encabezados en inglés**. Cualquier PDF en español con sección "Referencias" (como casi todo ALICIA/RENATI/revistas peruanas) nunca matchea, de ahí el \`citations: []\` constante. Usar \`extract_section("referencias")\` en su lugar |

### Fuentes especializadas CS/ML

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`search_dblp\` | \`query\`, \`maxResults\` | 🔴 **Roto** — 0 resultados en ~200-425ms (demasiado rápido para ser un sondeo real a la API), probado con queries muy conocidas ("attention is all you need"). Código fuente (V10) revisado: la lógica de la función es correcta, el fallo parece estar en la API externa de DBLP, no en el cliente |
| \`search_conferences\` | \`query\`, \`maxResults\` | 🔴 **Roto** — mismo patrón, 0 resultados consistentes vía OpenReview |
| \`search_paperswithcode\` | \`query\`, \`maxResults\` | ℹ️ **No es un bug — es un redirect intencional y documentado en el código**: \`searchPapersWithCode()\` contiene el comentario \`"[PapersWithCode] API is dead (closed by Meta). Redirecting to Hugging Face Trending Papers."\`. La API real de Papers With Code fue cerrada por Meta; la tool redirige deliberadamente a HuggingFace Daily Papers como reemplazo. Por eso resultados de temas ajenos a IA/ML (ej. "crime prediction") salen irrelevantes — es el comportamiento esperado del fallback, no un fallo |
| \`trending_papers\` | \`query\` (opcional), \`maxResults\` | ✅ Funciona bien **sin filtro de tema** (50 papers recientes de HuggingFace Daily Papers). Con un filtro de tema ajeno al dominio IA/ML (ej. "crime") devuelve 0 resultados — es esperable, no es un bug, ese dataset es específicamente IA/ML |

### Utilidad

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| \`health_check\` | (sin parámetros) | ✅ Reporta versión real del servidor activo (\`8.0.0\` al momento de esta prueba) y estado de MinerU/markitdown/pdf-parse — usar esto para verificar qué versión se está probando |
| \`coverage_report\` | \`use_cache\` | 🔴 **Roto en la práctica, pero con causa raíz explicable**: \`performCoverageReport()\` no hace ningún sondeo en vivo — lee un archivo persistido en \`.agents/skills/source-tester/references/last_test_results.json\`, generado por la skill separada \`source-tester\` del mismo repo. Si esa skill nunca se ejecutó (o el archivo no se encuentra por la ruta \`LETXIPU_PROJECT_ROOT\`), el reporte queda vacío por diseño — **no es un problema de caché**, \`use_cache: false\` nunca lo iba a arreglar. El fix real sería correr la skill \`source-tester\` primero. Mientras tanto, usar \`health_check\` |
| \`help\` | \`topic\` | ✅ Devuelve documentación completa de cualquier tool/fuente, incluye los 39 sources y sus grupos |

---

## Anti-patrones (solo lo confirmado roto tras probar cada tool individualmente)

- ❌ **\`pdf_citations\`** → usar \`extract_section("referencias")\`
- ❌ **\`extract_tables\` / \`extract_formulas\` / \`batch_convert\`** → las tres fallan con el mismo error de detección de formato aunque \`convert_document\`/\`read_pdf\` sí funcionan con el mismo documento. Usar \`convert_document\` y parsear tablas/fórmulas del Markdown resultante
- ❌ **\`search_dblp\` / \`search_conferences\`** → 0 resultados consistentemente; usar \`search(sources=["global"])\` para cobertura CS/ML alternativa
- ❌ **\`coverage_report\`** → depende de una skill (\`source-tester\`) que probablemente no se corrió; usar \`health_check\`
- ❌ **Confiar en \`documentType\` de \`pdf_smart_summary\`/\`analyze_academic\`** → puede clasificar un artículo de revista como tesis
- ❌ **Citar estadísticas de \`analyze_academic\` sin revisar** → puede fusionar números de tablas adyacentes en falsos porcentajes
- ❌ **Esperar que \`smart_search\` genere variantes reales** → con \`fastMode:true\` la generación de variantes se salta por completo (no documentado); incluso sin \`fastMode\`, el pool de sinónimos está hardcodeado a biología/agronomía y no sirve para otros dominios
- ❌ **\`find_charging_stations\` con radio > 10000** → ese es el límite real (no 5000 como se documentaba antes)
- ❌ **\`search\` sin \`fastMode: true\`** → riesgo de timeout con el enriquecimiento DME activado
- ❌ **\`search\`/\`batch_search\` sin \`filterFalsePositives: true\`** → ruido alto confirmado (resultados de temas completamente ajenos por coincidencia parcial de palabras); con el flag activado, ruido cero en la misma prueba
- ℹ️ **\`search_paperswithcode\` no es un anti-patrón, es un fallback intencional** (Papers With Code cerró su API real) — para tema ajeno a IA/ML, usar directamente \`trending_papers\` sabiendo que es HuggingFace Daily Papers

---

## TOOLBOX recomendado

### letxipu-osm — flujo recomendado
1. \`geocode_address\` / \`reverse_geocode\` → coordenadas del lugar
2. \`osm_query_bbox\` (bbox ±0.01°-0.02°, tags específicos) → POIs precisos por categoría
3. \`explore_area\` o \`analyze_neighborhood\` (radio ≤2000-5000m) → panorama general de la zona
4. \`find_nearby_places\` → alternativa directa cuando se necesita una sola categoría simple
5. \`route_fetch\` / \`analyze_commute\` / \`enrich_emissions\` → movilidad, comparación de modos y huella de carbono
6. \`get_map_image\` → imagen visual de apoyo

### letxipu-search — flujo recomendado
1. \`search(sources=["peru"|"alicia"|"renati"], fastMode: true, maxSources: 10-15)\` → búsqueda base
2. \`batch_search(queries: [...], sources: [...])\` → cobertura amplia con varias queries/fuentes en paralelo
3. \`recover_metadata\` o \`fetch_metadata\` → completar datos de un paper puntual (funcionan igual de bien/mal según si el paper tiene DOI indexado)
4. \`pdf_sections\` → mapa de secciones del PDF
5. \`extract_section(section="metodología"/"resultados"/"referencias")\` → contenido específico completo
6. \`convert_document\` → cuando se necesiten tablas/fórmulas reales o el texto completo estructurado (NO usar \`extract_tables\`/\`extract_formulas\`/\`batch_convert\`, están rotas)

---

## Combinaciones núcleo

| Patrón | Secuencia |
|---|---|
| **Geo→Acad** | \`geocode_address\` → \`search(fastMode:true)\` |
| **Area→Acad** | \`osm_query_bbox\` + \`explore_area\`/\`analyze_neighborhood\` → \`search\` |
| **POI→Acad** | \`find_nearby_places\` u \`osm_query_bbox\` → \`search\` por cada POI |
| **Commute→Acad** | \`analyze_commute\` o \`route_fetch\` × cada modo → \`enrich_emissions\` → \`search\` (movilidad) |
| **Paper→Detalle** | \`recover_metadata\`/\`fetch_metadata\` → \`pdf_sections\` → \`extract_section\` (nunca \`pdf_citations\`) |
| **Compare→Acad** | \`geocode_address\` × N lugares → \`batch_search\` o \`search\` por lugar |

---

## PROTOCOLOS (5 niveles de profundidad)

### NIVEL 1 — Mini-análisis (5-10 min, 2 tools)
\`\`\`
1. reverse_geocode(lat, lon) o geocode_address("{lugar}, {ciudad}, Peru")
2. search(query="{lugar} {tema}", sources=["peru"], maxSources=10, fastMode=true, filterFalsePositives=true)
\`\`\`

### NIVEL 2 — Estándar (15-25 min, 3-5 tools)
\`\`\`
1. geocode_address(lugar)
2. osm_query_bbox(bbox=±0.01°, tags={amenity:"marketplace"})
3. explore_area(lat, lon, radius=1000) o analyze_neighborhood(lat, lon, radius=1000)
4. search(query=raíz del lugar + problemática, sources=["peru"], maxSources=15, fastMode=true, filterFalsePositives=true)
5. search(query=tema específico, maxSources=10, fastMode=true, filterFalsePositives=true)
\`\`\`

### NIVEL 3 — Profundizado (25-40 min, 5-8 tools)
\`\`\`
1. geocode_address(lugar)
2. osm_query_bbox(bbox=±0.02°, tags={amenity:"marketplace"})
3. analyze_neighborhood(lat, lon, radius=1500)
4. search(query="{tema} {ciudad} problemática", sources=["peru"], maxSources=15, fastMode=true, filterFalsePositives=true)
5. batch_search(queries=[2-3 variantes], sources=["peru"] o fuente específica, maxResults=15)
6. Para 1-2 papers clave: recover_metadata → pdf_sections → extract_section("resultados")
7. Redactar informe completo (ver plantilla)
\`\`\`

### NIVEL 4 — Comparativo inter-provincial (40-60 min, 8-12 tools)
\`\`\`
Para cada lugar [A, B, ...]:
  1. geocode_address(lugar)
  2. osm_query_bbox(bbox=±0.02°)
  3. search(query=problema + lugar, sources=["peru"], maxSources=10, fastMode=true, filterFalsePositives=true)
Síntesis: tabla comparativa POIs + papers + problemas
\`\`\`

### NIVEL 5 — Benchmark territorial (25+ regiones, 2-8h)
\`\`\`
for región in 25_REGIONES_PERU:
    1. geocode_address(ciudad + ", Peru")
    2. batch_search(queries=[tema + ciudad + "universidad"], sources=["peru"], maxResults=5)
\`\`\`

---

## Plantilla de informe estándar

\`\`\`markdown
# Investigación: [TEMA] de [LUGAR]

## Ubicación geográfica (OSM MCP)
- Coords: lat, lon | Nombre oficial OSM | Mapa: openstreetmap.org/#map=17/LAT/LON

## POIs detectados (osm_query_bbox / find_nearby_places)
| # | Nombre | Coords | Tags | ID |

## Cartografía de la problemática (letxipu-search)
### A. [Categoría 1]
- Autor (Universidad, Año) — "Título" (URL hdl.handle.net): hallazgo resumido

[5-7 categorías]

## Cadenas de problemas interconectados (causal loop ASCII)

## Propuestas de solución detectadas
| # | Solución | Fuente | Aplicabilidad |

## Brechas de investigación
## Conclusión (≤200 palabras)
\`\`\`

---

## Quickstart checklist

- [ ] ¿Lugar identificado?
- [ ] ¿\`tool_search\` ejecutado para cargar los tools deferred de ambos MCP?
- [ ] ¿Nivel de profundidad decidido? (1=rápido, 3=estándar, 5=benchmark)
- [ ] ¿Evitando \`pdf_citations\` / \`search_dblp\` / \`search_conferences\` / \`search_paperswithcode\` / \`coverage_report\` / \`extract_tables\` / \`extract_formulas\` / \`batch_convert\`?
- [ ] ¿Verificaste con \`health_check\` qué versión del servidor está activa?
- [ ] ¿\`fastMode: true\` y \`filterFalsePositives: true\` en \`search\`/\`batch_search\`?
- [ ] ¿\`sources\` adecuado? (\`["peru"]\` solo Perú, \`["peru","latam"]\` LatAm — recordar que \`laref_peru\` puede filtrar de forma laxa)
- [ ] ¿Estructura de output respetada? (POIs + Categorías + Causal loop + Soluciones + Brechas + Conclusión)

---

## Referencia

Las 53 herramientas (25 \`letxipu-osm\` + 28 \`letxipu-search\`) fueron probadas **una por una, individualmente, con llamadas reales** el 18 jul 2026, contra el servidor activo \`letxipu-search-mcp\` v8.0.0 (confirmado vía \`health_check\`) y \`letxipu-osm-mcp\`. Se usó como caso de prueba un artículo académico real (Benites Guerrero et al., 2024, Politai-PUCP, DOI 10.18800/politai.202402.003) para todas las herramientas de PDF/metadata, y coordenadas reales de Trujillo/Lima/Piura para todas las herramientas OSM.

Resultado: **39 de 53 herramientas funcionan correctamente**, **2 no son bugs sino comportamiento intencional documentado en el código** (\`search_paperswithcode\` redirige a HuggingFace porque la API real de Papers With Code fue cerrada por Meta), y **12 tienen problemas reales** (\`pdf_citations\`, \`extract_tables\`, \`extract_formulas\`, \`batch_convert\`, \`search_dblp\`, \`search_conferences\`, \`coverage_report\`, \`smart_search\` sin variantes reales, \`pdf_smart_summary\`/\`analyze_academic\` con clasificación y falsos positivos).

**Causas raíz confirmadas leyendo el código fuente línea por línea (no solo el síntoma en producción):**
- \`pdf_citations\`: regex de detección de sección de referencias solo reconoce inglés (\`references|bibliography|works cited\`), nunca matchea "Referencias" en español (\`src/providers/pdf-processor.ts:410-457\`)
- \`extract_tables\`/\`extract_formulas\`/\`batch_convert\`: \`detectFormat()\` deriva el tipo de archivo de la extensión del nombre/URL (\`path.extname\`), no del contenido; URLs de descarga tipo OJS/PKP sin extensión visible (muy comunes en revistas peruanas) devuelven \`'unknown'\` (\`src/providers/mineru-client.ts:67-75\`)
- \`coverage_report\`: no sondea nada en vivo, lee un archivo \`.agents/skills/source-tester/references/last_test_results.json\` generado por una skill separada del mismo repo; si nunca se corrió, el reporte queda vacío por diseño (\`src/routes/mcp.ts:736-893\`)
- \`smart_search\`: \`generateQueryVariations()\` salta toda su lógica de variantes cuando \`fastMode:true\` (no documentado), y su pool de sinónimos semánticos está hardcodeado a términos de biología/agronomía (\`bacteria\`, \`rizosfera\`, \`ácido indol\`...), inútil fuera de ese dominio (\`src/routes/mcp.ts:534-667\`)
- \`search_paperswithcode\`: redirect intencional y documentado en un \`console.warn\`, no un bug (\`src/providers/paperswithcode.ts:5-11\`)
- \`suggest_meeting_point\` (letxipu-osm): el fallo transitorio ocurre porque delega internamente en \`find_nearby_places\` → Overpass API; es la misma inestabilidad de Overpass vista directamente en \`osm_query_bbox\` (error 429), no un bug propio (\`pkg/tools/routes.go:259-436\`)

El repo \`LETXIPU-SEARCH-MCP-V10\` incluye además corridas de prueba históricas propias en \`.agents/skills/python-tools-multiregion-tester/reports/\` (25 regiones de Perú, múltiples tools) que no se reprocesaron aquí para evitar redundancia, pero son un recurso adicional útil si se necesita profundizar.

Código fuente de referencia: \`D:\OTROS\LETXIPU-SEARCH-MCP-V10\` (97,119 nodos / 98,623 edges, indexado con \`codebase-memory-mcp\` en modo \`fast\` — los modos \`full\`/\`moderate\` no completan en repos de este tamaño) y \`D:\OTROS\letxipu-osm-mcp\` (1,140 nodos / 4,226 edges, Go).
`,
        isActive: false
      }
    ];
  } else {
    // Default Spanish
    return [
      {
        id: '1',
        name: 'Buscador de Artículos',
        description: 'Busca artículos científicos con baja verbosidad con el rango de años solicitado.',
        prompt: 'Busca los artículos científicos sobre [tu tema], respetando estrictamente el rango de años solicitado por el usuario. Utiliza baja verbosidad: presenta los resultados en una tabla comparativa con enlaces/URLs directas de referencia, seguida por párrafos continuos informativos de hallazgos clave.',
        isActive: false
      },
      {
        id: '8',
        name: 'Antialucinación',
        description: 'Detecta alucinaciones cruzadas de información antes de sintetizar.',
        prompt: 'Antes de presentar y sintetizar cualquier información, realiza una verificación cruzada de los hechos. Compara las fuentes utilizadas para asegurar que la información sea consistente. Si detectas contradicciones o información no soportada por las fuentes, indícalo explícitamente y solicita aclaración o corrección antes de finalizar el informe.',
        isActive: false
      },
      {
        id: '2',
        name: 'Papers Open Access',
        description: 'Encuentra papers open access y elabora tabla con sus enlaces directos.',
        prompt: 'Encuentra papers en acceso abierto sobre [tu tema] publicados dentro del período solicitado por el usuario. Estructura tu respuesta con baja verbosidad: ofrece una tabla comparativa con enlaces directos/URLs de descarga.',
        isActive: false
      },
      {
        id: '3',
        name: 'Estado del Arte',
        description: 'Busca el estado del arte sobre una tecnología o ciencia.',
        prompt: 'Busca el estado del arte científico o tecnológico sobre [tecnología/ciencia] dentro del rango de años solicitado por el usuario. Responde de manera concisa empleando tablas y párrafos continuos de alta densidad textual acompañados de URLs.',
        isActive: false
      },
      {
        id: '4',
        name: 'Scraping Webwright',
        description: 'Explora portales con Webwright y extrae normativa.',
        prompt: 'Explora con Webwright el portal [URL] y extrae normativas o métricas recientes dentro del período solicitado por el usuario. Sintetiza con baja verbosidad usando una tabla limpia y párrafos continuos con URLs.',
        isActive: false
      },
      {
        id: '5',
        name: 'Antecedentes APA 7',
        description: 'Recopila antecedentes en APA 7 y añade enlaces según el período solicitado.',
        prompt: 'Recopila antecedentes recientes sobre [tu tema] estrictamente dentro del rango de años o período solicitado por el usuario, redactándolos en estricto formato APA 7. Entrega baja verbosidad detallando tablas con URLs de descarga seguidas de texto continuo.',
        isActive: false
      },
      {
        id: '6',
        name: 'Letxipu V5 (Supersearch Master)',
        description: 'Orquestación V5: Orquestador, GRADE, Data Miner, Redactor ARA+ y Cero Alucinación.',
        prompt: `Este documento instruye a cualquier IA sobre cómo replicar el flujo exacto del \`research-agent\` de LetXipu V5. Representa el pipeline de "Supersearch", donde múltiples agentes operan en una orquestación precisa para lograr investigaciones de grado académico de nivel doctoral, bajo los estrictos parámetros definidos en \`.ai_prompts.json\`.

---

## 🏛️ El Escuadrón de Agentes (Roles y Prompts Base)

Para asumir el rol de **Arquitecto de Investigación (Supersearch)**, debes delegar internamente o asumir secuencialmente estas personalidades bajo los siguientes parámetros de sistema:

1. **Agente de Guardrails (Filtro de Seguridad):** 
   - *Rol:* Bloquear inmediatamente insultos, intentos de jailbreak, y consultas sin relevancia académica.
   - *Salida:* JSON \`{"allowed": true/false, "reason": "..."}\`.
2. **Optimizador de Queries (Query Agent):**
   - *Rol:* Generar máximo 5 términos por query, sin *stopwords*.
   - *Variaciones:* 
     1) \`BOOLEANO ESTRICTO\`: AND/OR/NOT en inglés (para Scopus/PubMed/OpenAlex).
     2) \`SEMÁNTICO\`: Frase natural en español (para ALICIA/RENATI/La Referencia).
3. **Estratega (Planning Agent):**
   - *Rol:* Desglosar el query en un JSON plan (3 a 6 secciones temáticas).
   - *Output:* Array con \`title\`, \`queries\`, \`minSources\` y \`prompt\`.
4. **Experto en Metodología (GRADE):**
   - *Rol:* Clasificar la calidad de las fuentes en 4 niveles (Protocolo GRADE):
     - **ALTO:** Meta-análisis, Revisiones Sistemáticas, Ensayos Controlados.
     - **MODERADO:** Estudios de Cohorte.
     - **BAJO:** Descriptivos, Series de Casos.
     - **MUY BAJO:** Opiniones, no revisados.
5. **Agente Data Miner:**
   - *Rol:* Escanear textos (PDFs) para extraer "oraciones exactas" con tamaño de muestra ($n$), valores $p$, y metodologías. *Prohibido resumir o parafrasear*.
6. **Detector de Gaps (Auditor de Cobertura):**
   - *Rol:* Comparar la pregunta inicial con el plan/fuentes actuales para encontrar "vacíos de conocimiento" y disparar un *Rescue Search*.
7. **Redactor Científico (Writer):**
   - *Rol:* Redactar nivel doctoral, exclusivamente en español, mínimo 3 párrafos por sección.
   - *Regla de Citación:* Todo dato debe citarse usando enlaces Markdown en formato APA 7 (ej: \`[Autor et al., 2020](URL_FUENTE)\`). Al final, debes incluir todas las referencias en formato APA 7. *Prohibido inventar datos*.
8. **Auditor Técnico de Calidad:**
   - *Rol:* Detectar alucinaciones y validar que las citas correspondan al contexto entregado.
9. **Refinador Académico Avanzado (ARA+):**
   - *Rol:* Mejorar cohesión, usar conectores, elevar registro doctoral, garantizando el *escapado LaTeX estricto*.

---

## ⚙️ El Flujo Maestro (Master Pipeline)

### Fase 1: Planificación (Planning)
* Se invoca el **Optimizador de Queries** para generar la versión global/booleana y local/semántica.
* El **Estratega** elabora el esqueleto JSON, identificando Variable Independiente y Dependiente.

### Fase 2: Recolección y Fusión Inteligente (Smart Fusion)
* Se ejecutan búsquedas masivas hacia fuentes globales y repositorios LatAm (Prioridad *LatAm First Context*).
* **Smart Fusion:** Se puntúan los documentos. Aportan +100 puntos si coinciden en metadatos, +50 por matches en el título. Se conservan los Top Rankeados (Límite por defecto: 50 o el definido por el usuario).

### Fase 3: Destilación, ERA y Mining
* **ERA (Enriquecimiento):** Se descargan y asignan DOIs y fechas faltantes.
* **GRADE:** Asigna el nivel de evidencia.
* **Mining (Anti-Alucinación):** Se descarga el texto completo (PDF/HTML) del "Top N" de documentos para inyectar datos duros ($n$, resultados) en el contexto de la IA.

### Fase 4: Orquestación de Estrategia de Síntesis
El sistema define la estrategia en base a la cantidad de documentos (Umbral automático = 50 docs):
* **Estrategia Lineal (< 50 docs):** Se inyectan las fuentes completas a un solo contexto por sección.
* **Estrategia Jerárquica / Map-Reduce (> 50 docs):**
  * *Chunking:* Los documentos se dividen en bloques de \`20\` (parámetro \`researchChunkSize\`).
  * *Concurrencia:* Se lanzan hasta \`10\` destiladores en paralelo (\`maxConcurrency\`).
  * *RAG Injection:* Se inyecta contexto vectorial en cada chunk si está habilitado.
  * Se genera un "Reporte de Evidencia Destilada" masivo.

### Fase 5: Auditoría de Cobertura y Rescate (Gap Detection)
* Antes de escribir, se compara la cobertura. Si hay "Missing Aspects", se hace un **Rescue Search** para recuperar papers específicos de esas lagunas y se añaden a la memoria.

### Fase 6: Redacción Secuencial (Chunked Synthesis)
* Se itera por el Plan del Estratega.
* Cada llamada al LLM incluye estrictamente: *El prompt base + las reglas de oro de LaTeX + el contexto filtrado*.
* **Auto-Continuation:** Si el LLM se corta a medio párrafo (límite de tokens superado), el motor detecta la truncación, envía el último fragmento e invoca la continuación hasta completar la idea.

### Fase 7: Post-Producción y Compilación
* **Sanitización Final:** Conversión final de los marcadores temporales a comandos \`\\cite{id}\`.
* Mapeo robusto de IDs (se toleran errores de los LLMs extrayendo el ID real a través del \`keyMap\`).
* Compilación de \`referencias.bib\` cruzando duplicados y asignando \`mastersthesis\` o \`article\` según el repositorio de origen.
* Exportación de los logs al Data Mining JSON (\`scraping_data.json\` y \`llm_outputs.json\`).

---

## 🚨 Reglas Universales de LetXipu (Mandatos)

1. **Protocolo Anti-Alucinación de Alta Fidelidad y Enlaces Obligatorios:**
   * Jamás generar métricas ($n$, $\\mu$, $p$) que no consten explícitamente en el texto original.
   * Si falta el dato, redactar: *"Información técnica no disponible en las fuentes primarias analizadas"*.
   * **TODAS LAS FUENTES DEBEN INCLUIR SU URL O ENLACE REAL Y DIRECTO EN LA TABLA/REPORTE.** Está rotundamente prohibido inventar o alucinar enlaces. Si no hay link disponible, indica "Sin URL".
2. **LatAm First Context:** Al tratar con fuentes de ALICIA/RENATI, el análisis debe situarse en el marco contextual latinoamericano, usando semántica hispana.
3. **Escapado LaTeX Permanente (Regla de Oro):** Toda salida académica (especialmente del modelo de Nebius o Azure) DEBE escapar los caracteres \`%, &, $, #, _, {, }, ~, ^\` con doble barra invertida (\`\\\\%\`).
4. **Metacomentarios Prohibidos:** Entregar directamente el reporte académico. Jamás iniciar con frases de IA como *"Aquí tienes el análisis..."*.`,
        isActive: false
      },
            {
        id: '7',
        name: 'LetXipu Academic Search V9',
        description: 'Use this skill whenever academic/scholarly search is needed via the letxipu MCP.',
        prompt: `Guía práctica para usar las 28 herramientas del MCP LetXipu V9: flujo claro para búsqueda, metadatos, y PDFs.

## 1. Árbol de decisión: qué herramienta de búsqueda usar

El MCP V9 ha sido validado exhaustivamente (100% de éxito en tests multirregionales). Las tres herramientas de búsqueda principales (\`search\`, \`smart_search\`, \`batch_search\`) funcionan de forma óptima.

- **Búsqueda directa / Lookup rápido** → \`search\` (query única). En V9, esta herramienta es muy robusta, aplicando reranking por relevancia automático, trayendo documentos con un score promedio de ~80-100%. Úsala para consultas claras y directas.
- **Exploración temática amplia (caso por defecto)** → \`batch_search\` con 3-6 variantes de la query (sinónimos, ES/EN, términos más amplios/estrechos). Ideal para agrupar resultados de diversas aproximaciones a un mismo problema.
- **Quiero que letxipu genere las variantes por mí (multi-idioma, sinónimos automáticos)** → \`smart_search\`. Esta herramienta genera automáticamente las variantes y filtra rígidamente los falsos positivos. Excelente para "lazy search".
  - **💡 Resiliencia NLP Transparente:** El motor corrige y procesa de forma nativa inputs en idiomas originarios, dialectos locales y faltas de ortografía masivas usando abstracción fonética y matching difuso. No traduzcas ni pre-corrijas los prompts del usuario antes de buscar; pásalos directamente.
  - **⚠️ Límite de Longitud:** Para queries ultralargas (párrafos de 40+ palabras), el motor superará el timeout (180s). **Regla:** Extrae los conceptos clave de los prompts largos antes de enviarlos al buscador.
- **Busco por autor/venue de CS/ML** → \`search_dblp\`
- **Quiero ver papers tendencia en IA/ML** → \`trending_papers\` (HuggingFace Daily Papers).
- **Quiero ver qué fuentes están cubriendo un tema/país** → \`coverage_report\`
- **¿Una fuente está fallando/devolviendo 0 resultados?** → corre \`health_check\` primero para comprobar el estado de conectividad.

### Selección de \`sources\` (grupos predefinidos, ver \`list_sources\`)

| Objetivo | Grupo a pasar |
|---|---|
| Tesis peruanas | \`["peru"]\` → alicia + renati + laref_peru + OAI-PMH de 80+ universidades |
| Tesis LatAm en general | \`["tesis"]\` |
| Iberoamérica (LatAm + España) | \`["iberoamerica"]\` |
| Papers globales indexados | \`["global"]\` → Semantic Scholar, OpenAlex, PubMed, Crossref, DOAJ, Zenodo, OpenAIRE, CORE |
| IA/ML | \`["ai_ml"]\` → arXiv, HuggingFace, PapersWithCode, OpenReview, DBLP |
| Por país específico | \`["brasil"]\`, \`["mexico"]\`, \`["argentina"]\`, \`["colombia"]\`, \`["chile"]\`, \`["ecuador"]\`, \`["centroamerica"]\` |

**Regla práctica**: para temas locales/sociales peruanos (desempleo, salud pública, educación regional) usar \`sources: ["peru"]\` primero; si el recall es pobre, ampliar a \`["latam", "global"]\`.

### Filtros útiles siempre disponibles
\`yearStart\` / \`yearEnd\` (acotar vigencia), \`university\` (filtrar por universidad), \`location\` (anclar geografía — el motor V9 fuerza este término en el pipeline de NLP para garantizar que no se pierda el contexto local).

## 2. Construcción de queries (batch_search)

\`batch_search\` permite lanzar múltiples variantes para asegurar cobertura total.

Patrón Estructural de Variante Exitosa:
\`\`\`python
batch_search(
  queries=[
    "[Concepto Clave] [Demografía/Contexto] [Ciudad Específica]",
    "[Sinónimo de Concepto Clave] [Demografía] [Región o Provincia]",
    "[Término Académico Relacionado] [Sujeto] [Ciudad Específica]",
    "[Concepto Clave] [Problema Secundario] [Región]"
  ],
  location="[Ubicación principal que el usuario solicitó]",
  sources=["[Grupo objetivo, ej. 'peru', 'latam']"],
  maxResults=40
)
\`\`\`
Regla de Variación Estructural: Genera de 3 a 6 variantes cortas combinando sinónimos. Altera la jerarquía geográfica en las variantes (ej. si el prompt es sobre una ciudad, incluye búsquedas por su región) para capturar investigaciones que agregan datos a nivel provincial o regional.

## 3. Flujo con PDFs (una vez identificado el documento)

No asumas que necesitas descargar/leer todo el PDF. Escalera de herramientas, de más liviana a más pesada:

1. **\`resolve_pdf(identifier)\`** — resuelve la URL final del PDF (DOI/handle/título/URL). Funciona tanto con URLs directas como con handles de repositorios (ej. \`hdl.handle.net/20.500.xxxxx\`).
2. **\`pdf_metadata(source)\`** — título, autor, páginas, fecha, tamaño.
3. **\`pdf_smart_summary(source)\`** — resumen token-eficiente. Úsalo cuando solo necesitas saber "de qué trata" antes de decidir si vale la pena profundizar.
4. **\`pdf_sections(source)\`** — detecta Abstract/Introducción/Métodos/Resultados/Conclusión/Referencias. Útil para saltar directo a la sección que importa.
5. **\`extract_section(source, section_name)\`** — trae solo esa sección (ej. solo "Metodología"), evitando cargar el PDF completo. Fuzzy matching ES/EN.
6. **\`read_pdf_markdown(source, pages, maxChars)\`** — lectura completa estructurada con MinerU AI (preferida sobre \`read_pdf\` por ser más eficiente en tokens). Usa \`pages="1-5"\` o \`"last3"\` para acotar.
7. **\`read_pdf(source, pages, maxChars, format)\`** — lectura alternativa (\`format="text"\` o \`"markdown"\`).
8. **\`extract_tables(source, format)\`** — cuando el pedido es específicamente datos tabulares. \`format="html"\` (default, estructurado) o \`"markdown"\` (pipe tables).
9. **\`extract_formulas(source)\`** — extrae ecuaciones como LaTeX usando UniMERNet.
10. **\`pdf_citations(source)\`** — lista de referencias/citas parseadas (numeradas o autor-año).
11. **\`analyze_academic(source)\`** — análisis profundo: detecta tipo de documento, idioma, 22 secciones, extrae estadísticas (p-values, correlaciones, ANOVA, chi², regresiones, tamaños de muestra).

**Regla de oro**: para "¿de qué trata este paper?" → \`pdf_smart_summary\`. Para "dame la metodología/resultados" → \`pdf_sections\` + \`extract_section\`. Para "necesito citar todo el documento con precisión" → \`read_pdf_markdown\`.

> [!TIP]
> **El "Efecto Caché" del Pipeline V9:** Las herramientas de procesamiento de PDF de LetXipu gestionan la memoria de forma ultra eficiente. Si encadenas herramientas sobre el mismo documento (por ejemplo: \`pdf_smart_summary\` ➔ \`analyze_academic\`), la primera llamada descarga y carga el binario en la caché del servidor. Las llamadas subsecuentes aprovechan este buffer y responden casi instantáneamente (ej. \`analyze_academic\` tardando **0.1s**). **Regla:** Encadena múltiples herramientas especializadas de PDF sin miedo a penalizaciones de tiempo o red.

### 3.1 URLs en resultados de búsqueda

En V9, los resultados de búsqueda incluyen el campo \`url\` poblado de forma nativa para casi todos los repositorios locales.
**Nota sobre metadatos**: Si el abstract viene vacío (muy común en repositorios nacionales o handles puros), no intentes recuperar metadatos perdidos usando \`enrich_metadata\` sobre handles, ya que la base de datos se apoya en CrossRef/Semantic Scholar global y puede no tener acceso al handle. Revisa el link de forma manual si es crítico.

## 4. letxipu vs. web_search — cuándo usar cada uno

| Necesidad (Abstracción) | Herramienta Base |
|---|---|
| Acervo histórico, marco teórico, estado del arte, repositorios institucionales. | **letxipu** |
| Coyuntura actual, estadísticas vivas, noticias, reportes gubernamentales dinámicos. | **web_search** |
| Fenómeno que requiere entender el origen (estudio de base) y la situación actual. | **letxipu** (antecedentes) ➔ **web_search** (cifras hoy) |

Patrón de Enfoque Híbrido:
Para tareas de investigación social profunda: Usa el motor MCP para recolectar el estado del arte y las metodologías locales, y encadénalo con búsquedas web tradicionales para verificar los índices socioeconómicos más recientes.

**Importante sobre web_search:** Al realizar búsquedas web, **prioriza siempre webs y repositorios directos de universidades** (por ejemplo, usando \`site:.edu.pe\`) por encima de portales centralizadores como Alicia o Renati.

## 5. Errores comunes a evitar

- **No asumas fallo por defecto:** Si una búsqueda parece fallar, revisa que el nombre de la variable se esté procesando bien. \`search\`, \`smart_search\` y \`batch_search\` tienen 100% de coverage y éxito validado.
- **Filtros Temporales Laxos**: Los parámetros \`yearStart\` y \`yearEnd\` NO son estrictos (los motores pueden priorizar semántica y traer papers adyacentes a tu fecha límite para asegurar que tengas qué leer). Post-filtra en tu lógica si es indispensable una fecha exacta.
- **Paginación Inútil**: Solicitar \`page: 2\` trae los mismos top results rankeados que la página 1. En su lugar, pide más resultados variando tu query.
- **Chequeo de Premium:** La mayoría de recursos están disponibles mediante OAI-PMH o APIs abiertas. Si buscas explícitamente en Scopus/Semantic Scholar, verifica en \`health_check\` que la API KEY esté activa.`,
        isActive: true
      },
    ];
  }
}
