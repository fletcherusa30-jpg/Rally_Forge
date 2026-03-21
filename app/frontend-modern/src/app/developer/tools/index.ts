import { monacoEditorPanelTool } from './monaco-editor-panel';
import { jsonSchemaValidatorTool } from './json-schema-validator';
import { diffViewerTool } from './diff-viewer';
import { regexTesterTool } from './regex-tester';
import { dataExplorerTool } from './data-explorer';
import { consoleLoggerTool } from './console-logger';

export const developerToolsRegistry = [
  monacoEditorPanelTool,
  jsonSchemaValidatorTool,
  diffViewerTool,
  regexTesterTool,
  dataExplorerTool,
  consoleLoggerTool
];

export {
  monacoEditorPanelTool,
  jsonSchemaValidatorTool,
  diffViewerTool,
  regexTesterTool,
  dataExplorerTool,
  consoleLoggerTool
};
