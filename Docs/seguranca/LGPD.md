# Conformidade LGPD — Referência para projetos BPM

> **Para quem não é da área de TI:** A LGPD (Lei nº 13.709/2018) regula o uso de dados que identificam pessoas. Sistemas que guardam nome, CPF, e-mail de funcionários ou clientes precisam de cuidados documentados antes do go-live.

> **Para a IA:** Use na entrevista e no SPEC. **Não implemente** endpoints ou criptografia extras até o SPEC e o TI aprovarem.

---

## Quando se aplica

| Situação | Ação mínima |
|---|---|
| Landing com formulário (nome, e-mail) | Inventário no SPEC + destino dos dados + retenção |
| Sistema interno com usuários | Inventário + base legal + retenção |
| RH, saúde, financeiro pessoal | Acionar TI + jurídico; medidas reforçadas no SPEC |

**Fora do escopo do molde:** termo de privacidade, DPO, processos jurídicos — responsabilidade da gestão/RH.

---

## O que são dados pessoais

| Tipo | Exemplos |
|---|---|
| Básicos | Nome, CPF, RG, endereço, e-mail, telefone |
| Profissionais | Cargo, departamento (quando ligados a pessoa identificável) |
| Sensíveis | Saúde, biometria, religião — **proteção extra; aprovação explícita** |
| Acesso | IP, logs de login (interesse legítimo, com retenção definida) |

---

## Base legal (registrar no SPEC)

| Base | Quando usar | Exemplo BPM |
|---|---|---|
| Contrato | Vínculo trabalhista / prestação de serviço | Dados de funcionário no ERP interno |
| Obrigação legal | Exigência fiscal/trabalhista | Dados para eSocial |
| Interesse legítimo | Operação segura do sistema | Logs de acesso |
| Consentimento | Quando nenhuma outra base couber | Opt-in marketing explícito |

---

## Direitos dos titulares (planejar no SPEC)

| Direito | Prazo legal | O que o sistema pode precisar |
|---|---|---|
| Saber quais dados existem | 15 dias | Exportação ou relatório (V1 ou V2) |
| Corrigir dados | Imediato | Edição pelo usuário ou fluxo RH |
| Eliminar / anonimizar | Conforme política | Soft delete + anonimização após retenção |
| Portabilidade | 15 dias | Export JSON/CSV (se exigido) |

> Solicitações de titulares: encaminhar RH + TI. O SPEC deve dizer **se** a V1 inclui self-service ou só processo manual.

---

## Princípios técnicos (stack BPM)

### 1. Minimização

Antes de cada campo no Prisma, perguntar: *por que precisamos disso?*

```prisma
// ✅ Campos necessários ao domínio
model Cliente {
  id     String @id @default(uuid())
  nome   String
  email  String
  // ❌ Evitar: religião, estado civil, etc. sem justificativa no SPEC
}
```

### 2. Inventário no SPEC

Documente no SPEC (ou anexo):

| Entidade / tabela | Campo | Tipo de dado | Base legal | Retenção |
|---|---|---|---|---|
| usuarios | email | Pessoal básico | Contrato | Vínculo + 5 anos |
| leads | email | Pessoal básico | Consentimento | 24 meses |

### 3. Proteção em trânsito e repouso

| Medida | Padrão do molde |
|---|---|
| HTTPS em produção | Obrigatório |
| Senhas | bcrypt — nunca texto puro |
| Segredos | Variáveis de ambiente — nunca no código |
| CPF/dados sensíveis em repouso | Criptografar **se** o SPEC exigir busca limitada ou compliance reforçado |

### 4. O que nunca fazer

- Logar senha, token JWT completo ou CPF em texto claro em logs
- Expor dados pessoais em URLs ou respostas de API além do necessário
- Coletar campo “por precaução” sem uso definido

---

## Checklist LGPD (TI — antes do go-live)

Aplicável quando o SPEC marcar dados pessoais:

- [ ] Inventário de campos pessoais no SPEC
- [ ] Base legal por tipo de dado
- [ ] Política de retenção definida
- [ ] Processo de correção / exclusão descrito (manual ou sistema)
- [ ] HTTPS em produção
- [ ] Acesso a dados pessoais sensíveis restrito por permissão ([RBAC.md](./RBAC.md))
- [ ] Exportação ou processo manual para direitos do titular (se aplicável)
- [ ] Logs de acesso a dados pessoais ([AUDITORIA-LOGS.md](./AUDITORIA-LOGS.md)) — se exigido

---

## Referências no repositório

| Documento | Uso |
|---|---|
| `Docs/entrevista/INTERVIEW.md` | Perguntas sobre dados pessoais e retenção |
| `Docs/skills/SPEC-DRIVEN.md` | Seção de integrações e entidades |
| `Docs/projeto/APROVACAO-TI.md` | Bloco 3 — segurança e dados |
| `Docs/projeto/FORMULARIO-RASCUNHO-NEGOCIO.md` | Pré-entrevista |
