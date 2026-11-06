import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extensaoDoArquivo, nomeDoArquivo, podeVisualizar, tipoDoArquivo } from "../src/services/arquivosGerais/arquivosGeraisService.js";
import { CHAVES_DA_MATRIZ } from "../src/services/acesso/telas.js";

describe("Arquivos Gerais (05/11/2026)", () => {
  it("o nome do arquivo sem o caminho e sem caracteres de controle", () => {
    assert.equal(nomeDoArquivo("C:\\Users\\adao\\Treinamento NR-12.pdf"), "Treinamento NR-12.pdf");
    assert.equal(nomeDoArquivo("../../etc/passwd"), "passwd");
    assert.equal(nomeDoArquivo("  aviso\u0007.txt "), "aviso.txt");
  });

  it("a extensão e o tipo: o do navegador; sem ele (ou genérico), o da extensão", () => {
    assert.equal(extensaoDoArquivo("Manual.PDF"), "pdf");
    assert.equal(extensaoDoArquivo("sem-extensao"), "bin");
    assert.equal(tipoDoArquivo("application/pdf", "x.bin"), "application/pdf");
    assert.equal(tipoDoArquivo("application/octet-stream", "Aula.mp4"), "video/mp4");
    assert.equal(tipoDoArquivo("", "Planilha.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.equal(tipoDoArquivo("", "desconhecido.xyz"), "application/octet-stream");
  });

  it("o Visualizar só nos tipos que o navegador mostra (sem HTML e sem SVG)", () => {
    for (const t of ["application/pdf", "image/png", "image/jpeg", "video/mp4", "audio/mpeg", "text/plain"]) assert.equal(podeVisualizar(t), true, t);
    for (const t of ["text/html", "image/svg+xml", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]) assert.equal(podeVisualizar(t), false, t);
  });

  it("as telas Treinamentos e Informativos na matriz dos perfis", () => {
    const doGrupo = CHAVES_DA_MATRIZ.filter((c) => c.recurso === "ARQUIVOS_GERAIS").map((c) => c.chave);
    assert.deepEqual(doGrupo, ["arquivos_treinamentos", "arquivos_informativos"]);
  });
});
