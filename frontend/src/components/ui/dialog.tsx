"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { MENSAGEM_MODAL, useAlteracoesPendentes } from "@/lib/alteracoesPendentes"
import { iniciaisMaiusculas } from "@/lib/texto"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * O cabeçalho fixo dos modais (11/10/2026): o DialogHeader fica no topo ao rolar o modal, com o botão de fechar dentro
 * dele; sem cabeçalho, o botão fica no canto do modal, como antes. O topo do cabeçalho desconta o espaçamento do modal
 * (o Firefox prende o sticky dentro dele), e o foco inicial vai ao primeiro campo, não ao botão de fechar.
 */
const CabecalhoDoModal = React.createContext<{ fechar: boolean; registrar: () => () => void } | null>(null)

function BotaoFechar() {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      render={
        <Button
          variant="ghost"
          className="absolute top-2 right-2"
          size="icon"
        />
      }
    >
      <XIcon
      />
      <span className="sr-only">Fechar</span>
    </DialogPrimitive.Close>
  )
}

/**
 * O vigia das alterações do modal (13/10/2026): no DialogContent com `avisoAoSair`, algo digitado ou marcado deixa o
 * modal "sujo"; fechá-lo pelo X, pelo Esc ou clicando fora pergunta antes. O Cancelar (uma escolha) e o fechamento
 * depois de gravar não perguntam. Enquanto sujo, sair da tela ou recarregar também pergunta (alteracoesPendentes).
 */
const VigiaDoModal = React.createContext<{ marcarSujo: () => void } | null>(null)

function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  const sujoRef = React.useRef(false)
  const vigia = React.useMemo(() => ({ marcarSujo: () => (sujoRef.current = true) }), [])
  const aoMudar: DialogPrimitive.Root.Props["onOpenChange"] = (aberto, detalhes) => {
    if (!aberto && sujoRef.current && !window.confirm(MENSAGEM_MODAL)) {
      detalhes.cancel()
      return
    }
    if (!aberto) sujoRef.current = false
    onOpenChange?.(aberto, detalhes)
  }
  return (
    <VigiaDoModal.Provider value={vigia}>
      <DialogPrimitive.Root data-slot="dialog" onOpenChange={aoMudar} {...props} />
    </VigiaDoModal.Provider>
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

const FOCAVEIS =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([data-slot="dialog-close"]), [href], [tabindex]:not([tabindex="-1"])'

function DialogContent({
  className,
  children,
  showCloseButton = true,
  initialFocus,
  avisoAoSair = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** Os modais de formulário: com algo digitado ou marcado, fechar sem gravar pergunta antes. */
  avisoAoSair?: boolean
}) {
  const vigia = React.useContext(VigiaDoModal)
  const [sujo, setSujo] = React.useState(false)
  useAlteracoesPendentes(sujo)
  const marcarSujo = () => {
    if (!avisoAoSair || sujo) return
    setSujo(true)
    vigia?.marcarSujo()
  }
  // As caixas e as listas do Base UI são botões (sem o evento input): o clique nelas também conta. Os botões que
  // preenchem o formulário (como o Aplicar Padrão das realocações, 14/10/2026) levam data-altera.
  const aoClicar = (e: React.MouseEvent) => {
    if ((e.target as Element).closest?.('[role="switch"], [role="checkbox"], [role="radio"], [role="option"], [data-altera]')) marcarSujo()
  }
  const [cabecalhos, setCabecalhos] = React.useState(0)
  const popup = React.useRef<HTMLDivElement>(null)
  const focoInicial = React.useCallback(() => popup.current?.querySelector<HTMLElement>(FOCAVEIS) ?? true, [])
  const contexto = React.useMemo(
    () => ({
      fechar: showCloseButton,
      registrar: () => {
        setCabecalhos((n) => n + 1)
        return () => setCabecalhos((n) => n - 1)
      },
    }),
    [showCloseButton]
  )
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={popup}
        initialFocus={initialFocus ?? focoInicial}
        data-slot="dialog-content"
        onInputCapture={avisoAoSair ? marcarSujo : undefined}
        onClickCapture={avisoAoSair ? aoClicar : undefined}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        <CabecalhoDoModal.Provider value={contexto}>{children}</CabecalhoDoModal.Provider>
        {showCloseButton && cabecalhos === 0 && <BotaoFechar />}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  const modal = React.useContext(CabecalhoDoModal)
  const registrar = modal?.registrar
  React.useLayoutEffect(() => registrar?.(), [registrar])
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "sticky -top-4 z-10 -mx-4 -mt-4 flex flex-col gap-2 rounded-t-[inherit] bg-popover px-4 pt-4 pb-3",
        modal?.fechar && "pr-12",
        className
      )}
      {...props}
    >
      {children}
      {modal?.fechar && <BotaoFechar />}
    </div>
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

/** O título com iniciais maiúsculas, como os nomes das telas (11/10/2026); os textos de dados também. */
function DialogTitle({ className, children, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    >
      {React.Children.map(children, (c) => (typeof c === "string" ? iniciaisMaiusculas(c) : c))}
    </DialogPrimitive.Title>
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
