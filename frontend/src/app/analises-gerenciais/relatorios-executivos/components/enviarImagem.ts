import { relatoriosExecutivosService } from "../services/relatoriosExecutivosService";

/**
 * A foto para o relatório (16/10/2026): reduzida a até 1600 px no lado maior (a Imagem de Fundo, 20/10/2026, a até 2560,
 * para cobrir a tela inteira), com a proporção dela (largura ÷ altura). Em JPEG; a imagem com partes transparentes
 * (22/10/2026; antes, o fundo delas ficava branco), em PNG — ou em WebP, se o PNG passar do limite do envio.
 */
export async function prepararFoto(arquivo: File, maximo = 1600): Promise<{ foto: Blob; proporcao: number }> {
  const imagem = await createImageBitmap(arquivo).catch(() => {
    throw new Error("Não foi possível abrir a imagem: escolha uma foto em JPEG, PNG, WebP ou GIF.");
  });
  const escala = Math.min(1, maximo / Math.max(imagem.width, imagem.height));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(imagem.width * escala));
  tela.height = Math.max(1, Math.round(imagem.height * escala));
  const ctx = tela.getContext("2d")!;
  ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
  const gerar = (tipo: string, qualidade?: number) =>
    new Promise<Blob>((ok, erro) => tela.toBlob((b) => (b ? ok(b) : erro(new Error("Não foi possível preparar a foto."))), tipo, qualidade));
  // Algum pixel transparente: PNG (ou WebP, menor, se o PNG passar de 9 MB; o envio aceita até 10 MB).
  const pixels = ctx.getImageData(0, 0, tela.width, tela.height).data;
  let transparente = false;
  for (let i = 3; i < pixels.length && !transparente; i += 4) transparente = pixels[i] < 255;
  if (transparente) {
    const png = await gerar("image/png");
    return { foto: png.size <= 9 * 1024 * 1024 ? png : await gerar("image/webp", 0.9), proporcao: imagem.width / imagem.height };
  }
  // Sem transparência: JPEG, sobre o branco (o canvas começa transparente).
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, tela.width, tela.height);
  return { foto: await gerar("image/jpeg", 0.85), proporcao: imagem.width / imagem.height };
}

/** Prepara e envia a imagem (22/10/2026: o Trocar Imagem dos modais): o nome do arquivo no servidor e a proporção. */
export async function enviarImagem(relatorioId: string, arquivo: File, maximo = 1600) {
  const { foto, proporcao } = await prepararFoto(arquivo, maximo);
  const { arquivo: nome } = await relatoriosExecutivosService.enviarFoto(relatorioId, foto);
  return { arquivo: nome, proporcao };
}
