/**
 * Quem está com o SIG aberto (24/10/2026). Toda aba logada avisa a cada minuto (GET /presenca), e online é quem avisou
 * nos últimos 3 minutos; ao sair, o usuário deixa a lista na hora. A lista fica na memória do backend, que roda num
 * contêiner só: num reinício, ela se refaz no minuto seguinte. Só o Administrador vê a contagem, ao lado do nome dele no
 * alto da tela.
 */
const JANELA_MS = 3 * 60_000;

const vistos = new Map<string, { nome: string; em: number }>();

export const presencaService = {
  marcar(usuarioId: string, nome: string, agora = Date.now()) {
    vistos.set(usuarioId, { nome, em: agora });
  },

  sair(usuarioId: string) {
    vistos.delete(usuarioId);
  },

  /** Os nomes de quem está online, em ordem alfabética (e esquece quem passou da janela). */
  online(agora = Date.now()) {
    for (const [id, v] of vistos) if (agora - v.em > JANELA_MS) vistos.delete(id);
    return [...vistos.values()].map((v) => v.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
  },
};
