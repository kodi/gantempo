import type { Diagnostic, DiagnosticCode } from '../model/diagnostics';

/**
 * @deprecated Import `Diagnostic` from the package facade instead.
 * This compatibility alias is removed when the scene pipeline converges in M1 Slice 6.
 */
export type RenderDiagnostic = Diagnostic;

/** @deprecated Use `DiagnosticCode` instead. */
export type RenderDiagnosticCode = DiagnosticCode;
