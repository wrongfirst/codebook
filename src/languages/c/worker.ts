import harness from './harness.c?raw';
import { WASI, File, OpenFile, ConsoleStdout, WASIProcExit } from '@bjorn3/browser_wasi_shim';
import { createWorkerHandler } from '../base-worker';
import type { DiagnosticItem } from '../types';

// We import @yowasp/clang types only (erased at runtime)
import type { Command as YowaspCommand, Tree as YowaspTree } from '@yowasp/clang';

const CLANG_CDN_URL = 'https://cdn.jsdelivr.net/npm/@yowasp/clang@22.0.0-git20542-10/gen/bundle.js';

let runClang: YowaspCommand | null = null;
let isClangReady = false;

async function ensureClangReady(): Promise<void> {
  if (isClangReady && runClang) return;
  try {
    // Load from CDN to ensure import.meta.url inside the package resolves to the CDN,
    // avoiding Vite bundling issues and local 404s.
    const yowaspClang = await import(/* @vite-ignore */ CLANG_CDN_URL);
    
    runClang = (
      yowaspClang.runClang ||
      yowaspClang.commands?.clang ||
      yowaspClang.default?.runClang
    ) as YowaspCommand;

    if (!runClang) {
      throw new Error("Failed to find runClang in the loaded module");
    }

    // Warm up Clang to pre-fetch and compile WASM assets into memory
    await runClang(['clang', '--version'], {}, {
      stdout: () => {},
      stderr: () => {}
    });
    isClangReady = true;
  } catch (err) {
    console.error('[C Worker] Clang warmup failed:', err);
    throw err;
  }
}


function prepareSourceCode(userCode: string, testCode: string = ''): string {
  const hasMain = userCode.includes('main(') || testCode.includes('main(');

  let fullCode = harness + '\n\n';
  fullCode += '#line 1 "user.c"\n';
  fullCode += userCode + '\n\n';

  if (testCode.trim()) {
    fullCode += '#line 1 "test.c"\n';
    if (hasMain) {
      fullCode += testCode + '\n';
    } else {
      fullCode += 'int main(int argc, char** argv) {\n';
      fullCode += testCode + '\n';
      fullCode += '    return 0;\n';
      fullCode += '}\n';
    }
  } else if (!hasMain) {
    fullCode += 'int main(int argc, char** argv) {\n    return 0;\n}\n';
  }

  return fullCode;
}

function parseClangDiagnostics(stderrOutput: string): DiagnosticItem[] {
  const diags: DiagnosticItem[] = [];
  // Match lines like: user.c:12:5: error: expected ';' after expression
  const diagRegex = /(?:user\.c):(\d+):(\d+):\s*(error|warning|note):\s*(.*)/g;

  let match: RegExpExecArray | null;
  while ((match = diagRegex.exec(stderrOutput)) !== null) {
    const line = parseInt(match[1], 10) || 1;
    const column = parseInt(match[2], 10) || 1;
    const type = match[3];
    const message = match[4].trim();

    if (type === 'note') continue;

    diags.push({
      line,
      column,
      message,
      severity: type === 'error' ? 'error' : 'warning',
      source: 'clang'
    });
  }

  return diags;
}

createWorkerHandler({
  async init() {
    await ensureClangReady();
  },

  async execute(userCode: string, testCode: string = '') {
    await ensureClangReady();

    const source = prepareSourceCode(userCode, testCode);
    let compileStderr = '';

    const decoder = new TextDecoder('utf-8');

    let outputFiles: YowaspTree | undefined;
    try {
      const res = await runClang!(
        ['clang', '-O0', '-Wall', '-Wno-unused-variable', '-Wno-unused-function', 'main.c', '-o', 'main.wasm'],
        { 'main.c': source },
        {
          stdout: () => {},
          stderr: (bytes: Uint8Array | null) => {
            if (bytes) {
              compileStderr += decoder.decode(bytes);
            }
          }
        }
      );
      outputFiles = res as YowaspTree | undefined;
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: compileStderr || err?.message || String(err)
      };
    }

    const wasmBytes = outputFiles?.['main.wasm'];
    if (!wasmBytes || typeof wasmBytes === 'string' || !(wasmBytes instanceof Uint8Array)) {
      return {
        success: false,
        output: '',
        error: compileStderr || 'Compilation failed: no WebAssembly binary was generated.'
      };
    }

    // Run compiled WASM module via browser WASI shim
    let stdoutText = '';
    let stderrText = '';

    const stdoutFd = new ConsoleStdout((buffer: Uint8Array) => {
      stdoutText += decoder.decode(buffer);
    });

    const stderrFd = new ConsoleStdout((buffer: Uint8Array) => {
      stderrText += decoder.decode(buffer);
    });

    const stdinFd = new OpenFile(new File(new Uint8Array(0)));

    const wasi = new WASI(['main.wasm'], [], [stdinFd, stdoutFd, stderrFd]);

    try {
      const wasmBuffer = wasmBytes.buffer.slice(
        wasmBytes.byteOffset,
        wasmBytes.byteOffset + wasmBytes.byteLength
      ) as ArrayBuffer;
      const wasmModule = await WebAssembly.compile(wasmBuffer);
      const instance = await WebAssembly.instantiate(wasmModule, {
        wasi_snapshot_preview1: wasi.wasiImport
      });

      let exitCode = 0;
      try {
        wasi.start(instance as any);
      } catch (err: any) {
        if (err instanceof WASIProcExit) {
          exitCode = err.code;
        } else {
          throw err;
        }
      }

      const success = exitCode === 0;
      return {
        success,
        output: stdoutText,
        error: success ? (stderrText || undefined) : (stderrText || `Process exited with code ${exitCode}`)
      };
    } catch (runtimeErr: any) {
      return {
        success: false,
        output: stdoutText,
        error: runtimeErr?.message || String(runtimeErr)
      };
    }
  },

  async lint(userCode: string): Promise<DiagnosticItem[]> {
    if (!userCode.trim()) return [];

    try {
      await ensureClangReady();

      const source = prepareSourceCode(userCode, '');
      let compileStderr = '';
      const decoder = new TextDecoder('utf-8');

      try {
        await runClang!(
          ['clang', '-fsyntax-only', '-Wall', 'main.c'],
          { 'main.c': source },
          {
            stdout: () => {},
            stderr: (bytes: Uint8Array | null) => {
              if (bytes) {
                compileStderr += decoder.decode(bytes);
              }
            }
          }
        );
      } catch {
        // Compiler error expected when code has syntax errors
      }

      return parseClangDiagnostics(compileStderr);
    } catch (err) {
      console.warn('[C Worker Lint Error]:', err);
      return [];
    }
  },

  async reset() {
    isClangReady = false;
    await ensureClangReady();
  }
});
