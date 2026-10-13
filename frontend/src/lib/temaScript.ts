/** A chave do tema guardado neste navegador (13/10/2026; ver lib/tema.ts). */
export const CHAVE_TEMA = "sig.tema";

/** O script que aplica o tema guardado antes de a página aparecer (no <head> do layout), para não piscar o Padrão. */
export const SCRIPT_DO_TEMA = `try{var t=localStorage.getItem("${CHAVE_TEMA}");if(t==="claro"||t==="escuro"){document.documentElement.dataset.tema=t;if(t==="escuro")document.documentElement.classList.add("dark")}}catch(e){}`;
