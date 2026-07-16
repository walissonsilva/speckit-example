<!--
Sync Impact Report
- Version change: 0.0.0 (template) → 1.0.0
- Rationale: Initial ratification. Constitution was previously an unfilled template;
  this is the first complete definition of principles (MAJOR).
- Modified principles: none (first ratification, no prior titles to rename)
- Added sections:
  - Core Principles I–VI (Arquitetura em Camadas, Validação de Entrada,
    Convenções REST e Formato de Erro, Integrações Externas Resilientes,
    Disciplina de Testes, Observabilidade e Proteção de Dados)
  - Stack Tecnológica (Section 2)
  - Fluxo de Desenvolvimento (Section 3)
  - Governance
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ compatible, no edit needed
    (generic "Constitution Check" section already reads from this file)
  - .specify/templates/spec-template.md ✅ compatible, no edit needed
  - .specify/templates/tasks-template.md ✅ compatible, no edit needed
- Follow-up TODOs: none
-->

# WhatsApp Template Dispatch API Constitution

## Core Principles

### I. Arquitetura em Camadas
Toda funcionalidade DEVE ser dividida em quatro camadas com responsabilidades
estritamente separadas: **controller** (endpoint HTTP + DTO de entrada/saída),
**service** (regra de negócio), **repository** (acesso a dados/persistência) e
**providers de integração** (fila, chamadas HTTP externas). Controllers NUNCA
acessam banco de dados ou fila diretamente — toda interação passa pelo
service, que orquestra repositories e providers via injeção de dependência.
Rationale: separar essas responsabilidades mantém os controllers finos e
testáveis, isola regras de negócio de detalhes de infraestrutura, e permite
trocar implementações de fila/HTTP sem tocar em regra de negócio.

### II. Validação de Entrada
Todo payload de entrada DEVE ser validado por um DTO usando `class-validator`
(e `class-transformer` para coerção de tipos). Nenhum dado não validado pode
alcançar a camada de service. Toda requisição que falhar na validação DEVE
retornar HTTP 400 com um corpo de erro no formato padronizado definido no
Princípio III. Rationale: validação centralizada em DTOs elimina checagens
defensivas espalhadas pelo código e garante uma superfície de erro
consistente para consumidores da API.

### III. Convenções REST e Formato de Erro
Endpoints DEVEM usar status codes semânticos: **202** para processamento
assíncrono aceito (ex.: disparo de template enfileirado), **404** para
recurso inexistente, **409** para conflito de estado (ex.: template já
enviado, contato em estado incompatível), **422** para entidade sintaticamente
válida mas semanticamente não processável (ex.: template desativado). Todo
corpo de erro DEVE seguir o formato `{ code, message }`, sem exceções ou
formatos alternativos. Rationale: consistência de status code e formato de
erro reduz ambiguidade para clientes da API e simplifica tratamento de erro
no lado consumidor.

### IV. Integrações Externas Resilientes
TODA chamada a um serviço externo (fila de mensageria ou HTTP externo, ex.:
provedor de WhatsApp) DEVE declarar um timeout explícito e um comportamento
de falha definido — **fail-open** (segue com degradação aceitável) ou
**fail-closed** (bloqueia e retorna erro) — documentado na especificação da
feature antes da implementação. Nenhuma integração externa entra em produção
sem um fallback documentado para o caso de timeout ou indisponibilidade.
Rationale: disparos de WhatsApp dependem de provedores externos fora do
nosso controle; sem timeout e fallback explícitos, uma falha externa pode
travar a aplicação inteira ou mascarar silenciosamente perda de mensagens.

### V. Disciplina de Testes
Toda feature DEVE ter testes e2e (via supertest) cobrindo o caminho feliz e os
principais cenários de erro (400, 404, 409, 422, timeout de integração
externa). Toda regra de negócio crítica (ex.: elegibilidade de disparo,
resolução de template, deduplicação) DEVE ter teste unitário no service,
independente da camada HTTP. Rationale: testes e2e validam o contrato
externo da API; testes unitários no service permitem verificar regras de
negócio isoladamente e com rapidez, sem depender de infraestrutura HTTP ou
de fila.

### VI. Observabilidade e Proteção de Dados
Todo disparo DEVE gerar log de início e de fim da operação, correlacionados
por um correlation id único por requisição/disparo, propagado através de
todas as camadas e providers envolvidos. Nenhum log pode conter dados
sensíveis em texto claro — números de telefone DEVEM ser mascarados (ex.:
exibindo apenas os últimos 4 dígitos) em toda saída de log. Rationale:
rastreabilidade fim-a-fim é essencial para depurar falhas de disparo em um
fluxo assíncrono e multi-camada, e o mascaramento de dados protege
informação pessoal de contatos mesmo em ambientes de log centralizados.

## Stack Tecnológica

A API é construída em **NestJS**. Validação de DTOs usa `class-validator` e
`class-transformer`. Toda integração com fila de mensageria (ex.: BullMQ) e
com clientes HTTP externos DEVE ser encapsulada atrás de providers/interfaces
injetáveis, nunca instanciada diretamente em controllers ou services de
negócio. Qualquer nova dependência de infraestrutura (fila, cliente HTTP,
cache) DEVE seguir o mesmo padrão de encapsulamento em provider dedicado.

## Fluxo de Desenvolvimento

Toda revisão de código (PR) DEVE verificar, antes do merge: (a) separação de
camadas conforme o Princípio I; (b) presença de timeout e comportamento de
falha documentado para qualquer integração externa nova ou alterada
(Princípio IV); (c) cobertura de testes e2e e unitários exigida pelo
Princípio V; (d) logging com correlation id e mascaramento de dados
sensíveis conforme o Princípio VI. PRs que violem qualquer princípio sem
justificativa explícita registrada DEVEM ser rejeitados ou corrigidos antes
do merge.

## Governance

Esta constituição tem precedência sobre qualquer outra prática, convenção ou
preferência individual de implementação neste projeto. Emendas exigem: (1)
atualização deste arquivo com justificativa da mudança; (2) verificação e,
se necessário, atualização dos templates dependentes
(`plan-template.md`, `spec-template.md`, `tasks-template.md`); (3) incremento
de versão seguindo semântica — MAJOR para remoção ou redefinição
incompatível de princípios, MINOR para adição de novo princípio ou seção,
PATCH para esclarecimentos e correções de redação. Toda revisão de PR DEVE
verificar aderência aos princípios acima; complexidade que viole um
princípio DEVE ser explicitamente justificada na spec ou no plano da feature.

**Version**: 1.0.0 | **Ratified**: 2026-07-15 | **Last Amended**: 2026-07-15
