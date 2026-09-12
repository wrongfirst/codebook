export interface RenderMathOptions {
  throwOnError?: boolean;
}

export function renderMath(element: HTMLElement, options?: RenderMathOptions): void {
  if (typeof (window as any).renderMathInElement === 'function') {
    try {
      (window as any).renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: options?.throwOnError ?? false,
      });
    } catch {
      // Ignore KaTeX rendering errors on malformed math
    }
  }
}
