export interface ToolCallState {
  name: string;
  args: any;
  status: 'calling' | 'success' | 'failed' | 'pending_approval';
  result?: any;
  startTimestamp?: number;
  duration?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallState[];
  startTimestamp?: number;
  duration?: number;
}

export interface ToolProperty {
  type: string;
  description?: string;
  items?: {
    type: string;
    properties?: Record<string, any>;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  serverName?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, ToolProperty>;
    required?: string[];
  };
}

export interface ConfigStatus {
  mcpApiKeyConfigured: boolean;
  geminiApiKeyConfigured: boolean;
  mistralApiKeyConfigured: boolean;
  letxinetOk?: boolean;
  letxipuOk?: boolean;
  letxipuOsmOk?: boolean;
  mcpDetails: any;
  currentTime: string;
}

export interface ExecutionRecord {
  id: string;
  timestamp: string;
  toolName: string;
  args: any;
  duration: number;
  status: 'success' | 'failed';
  response?: any;
  error?: string;
}

export interface SourceDefinition {
  id: string;
  name: string;
  country: string;
  category: string;
  keyNeeded: boolean;
  description: string;
}

export interface SourceGroup {
  id: string;
  name: string;
  count: number;
  sources: string[];
}

export type AttachmentFormat = 'pdf' | 'office' | 'image' | 'text';
export type AttachmentExt = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'png' | 'jpg' | 'jpeg' | 'tiff' | 'tif' | 'bmp' | 'webp' | 'txt' | 'md';

export interface AttachedFile {
  path: string;
  name: string;
  ext: AttachmentExt;
  size: number;
  format: AttachmentFormat;
}

export interface KeysConfigured {
  mineruApiKey: boolean;
  markitdownAvailable: boolean;
}

