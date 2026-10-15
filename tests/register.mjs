import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";

// Usa o TypeScript já instalado; nenhum runner externo para os testes de regras.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = resolve("src", specifier.slice(2));
      const path = [base + ".ts", base + ".tsx"].find(existsSync);
      if (path) return { url: pathToFileURL(path).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.tsx?$/.test(url) && !url.includes("node_modules")) {
      const path = fileURLToPath(url);
      const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
        fileName: path,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
