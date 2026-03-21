import {
  DD214_SEMANTIC_ANCHOR_MAP,
  DD214_SEMANTIC_ANCHOR_MAP_VERSION,
  buildDD214SemanticExtractionMetadata,
} from '../../../backend/va_scanner/backend/shared/scanner/dd214SemanticAnchors.js';
import { looksLikeDD214, parseDD214 } from '../../../backend/va_scanner/backend/shared/scanner/dd214Scanner.js';

export type Dd214AnchorConfidence = {
  semantic: number;
  fallback: number;
  derived: number;
};

export type Dd214SemanticAnchorDefinition = {
  schemaPath: string;
  category: string;
  semanticAnchors: ReadonlyArray<RegExp>;
  positionalFallback: ReadonlyArray<string>;
  supportedVariants: ReadonlyArray<string>;
  notes: string;
  confidence: Dd214AnchorConfidence;
};

export type Dd214SemanticAnchorMap = Record<string, Dd214SemanticAnchorDefinition>;

export type Dd214SemanticExtractionMetadata = ReturnType<typeof buildDD214SemanticExtractionMetadata>;

export type Dd214ExtractionResult = ReturnType<typeof parseDD214>;

export function extractDd214(rawText: string): Dd214ExtractionResult {
  return parseDD214(rawText);
}

export function detectDd214(rawText: string): boolean {
  return looksLikeDD214(rawText);
}

export {
  DD214_SEMANTIC_ANCHOR_MAP,
  DD214_SEMANTIC_ANCHOR_MAP_VERSION,
  buildDD214SemanticExtractionMetadata,
  parseDD214,
  looksLikeDD214,
};

export default DD214_SEMANTIC_ANCHOR_MAP as Dd214SemanticAnchorMap;
