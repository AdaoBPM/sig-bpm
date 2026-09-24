const benefits = [
  {
    title: "Produção padronizada",
    description: "Processos repetíveis que reduzem retrabalho e garantem qualidade em escala.",
  },
  {
    title: "Prazo previsível",
    description: "Planejamento claro do pedido à entrega, com acompanhamento comercial.",
  },
  {
    title: "Suporte técnico",
    description: "Equipe BPM para orientar especificação, logística e aplicação das peças.",
  },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-2xl font-bold text-bpm-secondary md:text-3xl">
          Por que escolher a BPM
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Seção de benefícios de exemplo — a IA substitui por copy real após a entrevista.
        </p>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {benefits.map((item) => (
            <li
              key={item.title}
              className="rounded-md border border-border bg-background p-6 shadow-sm"
            >
              <h3 className="font-semibold text-bpm-secondary">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
