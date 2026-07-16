# Implementation Plan: Endpoint de Disparo de Template

**Branch**: `001-template-dispatch-endpoint` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-template-dispatch-endpoint/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Expor um endpoint `POST` que recebe `{ templateId, clientPhoneNumber }`, valida o payload,
busca o template no banco via repository (Prisma) e, se existir, enfileira um disparo
assíncrono via AWS SQS (encapsulado em um provider dedicado) contendo `templateId`,
`clientPhoneNumber` e `whatsappPhoneNumber`. Responde **202** com `dispatchId` em caso de
aceite, **404** se o template não existir, **422** se o template existir mas não tiver
`whatsappPhoneNumber`, e **400** para payload inválido. A chamada ao SQS usa timeout
explícito de 1s com comportamento fail-closed.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 20+ (runtime do NestJS 11)

**Primary Dependencies**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`),
`class-validator` + `class-transformer` (validação de DTO), Prisma ORM (`@prisma/client` +
`prisma` como dev dependency) para persistência do template, `@aws-sdk/client-sqs` para
enfileiramento, encapsulado em um `SqsQueueProvider` dedicado.

**Storage**: PostgreSQL via Prisma ORM (engine padrão para Prisma em serviços NestJS; não
especificado explicitamente pelo usuário — assumido como padrão do time, documentado em
`research.md`). Contém a tabela `Template`.

**Testing**: Jest (unit, já configurado no projeto) para regras de negócio no service;
Supertest (e2e, já configurado em `test/`) cobrindo os cenários 202/400/404/422/timeout de
SQS conforme Princípio V da constituição.

**Target Platform**: Servidor Linux (container Node.js), API HTTP stateless.

**Project Type**: web-service (projeto único NestJS já inicializado em `src/`).

**Performance Goals**: Resposta ao chamador (aceite ou rejeição) em menos de 1 segundo
(SC-001), sem aguardar envio efetivo ao cliente final.

**Constraints**: Timeout de 1s fail-closed na chamada ao SQS (FR-009); nenhum dado sensível
(números de telefone) em texto claro nos logs — mascarar exceto últimos 4 dígitos (Princípio
VI); correlation id (`dispatchId`) propagado por todas as camadas e providers envolvidos.

**Scale/Scope**: Um único endpoint HTTP (`POST /template-dispatches` ou equivalente),
camadas controller/service/repository/provider, sem novas entidades além de `Template` e
`Disparo` (mensagem de fila, não persistida).

**Ambiente de Desenvolvimento Local**: Docker Compose reproduzível com Postgres (persistência
do `Template` via Prisma) e LocalStack (SQS, para o `SqsQueueProvider` apontar em ambiente
local sem depender de credenciais/infra AWS reais). Fila criada automaticamente no startup do
LocalStack. Variáveis de ambiente (`DATABASE_URL`, `AWS_ENDPOINT_URL`/`SQS_QUEUE_URL`,
credenciais dummy) fornecidas via override para apontar a app para os containers locais. Este
é um passo de setup de ambiente (Fase 0), não altera requisitos da feature nem o código já
implementado nas Fases 1 e 2 — ver detalhes em [research.md](./research.md#8-ambiente-de-desenvolvimento-local-docker-compose).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|-----------|-----------|--------|
| I. Arquitetura em Camadas | Controller (DTO + endpoint HTTP) → Service (regra de negócio: buscar template, decidir aceite/rejeição, montar mensagem) → `TemplateRepository` (Prisma) → `SqsQueueProvider` (`@aws-sdk/client-sqs`). Controller não acessa Prisma nem SQS diretamente. | PASS |
| II. Validação de Entrada | DTO `DispatchTemplateDto` com `class-validator` (`@IsString`, `@IsNotEmpty`, `@IsPhoneNumber` ou regex E.164) valida `templateId` e `clientPhoneNumber` antes do service. Falha → 400 `{ code, message }`. | PASS |
| III. Convenções REST e Formato de Erro | 202 (aceite), 404 (template inexistente), 422 (template sem `whatsappPhoneNumber`), 400 (payload inválido); todos os erros no formato `{ code, message }`. | PASS |
| IV. Integrações Externas Resilientes | `SqsQueueProvider` declara timeout de 1s (via `AbortController`/`requestTimeout` do SDK) e comportamento fail-closed documentado no FR-009: timeout/erro → disparo tratado como não aceito. | PASS |
| V. Disciplina de Testes | Testes e2e (supertest) cobrindo 202, 400, 404, 422 e timeout de SQS (mock do provider); teste unitário do service cobrindo resolução de template e decisão de aceite/rejeição, isolado de HTTP/fila. | PASS (planejado para fase de tasks) |
| VI. Observabilidade e Proteção de Dados | `dispatchId` gerado no service, usado como correlation id em log de início/fim e propagado ao repository/provider; `clientPhoneNumber`/`whatsappPhoneNumber` mascarados em todo log (últimos 4 dígitos visíveis). | PASS |

Nenhuma violação identificada — `Complexity Tracking` não é necessário.

## Project Structure

### Documentation (this feature)

```text
specs/001-template-dispatch-endpoint/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
docker-compose.yml                         # Postgres + LocalStack (SQS) para dev local
docker/
└── localstack/
    └── init/
        └── 01-create-queue.sh             # cria a fila SQS no startup do LocalStack
.env.example                                # DATABASE_URL e overrides de SQS p/ LocalStack

prisma/
└── schema.prisma                          # modelo Template (Prisma)

src/
├── modules/
│   └── template-dispatch/
│       ├── template-dispatch.module.ts
│       ├── controllers/
│       │   └── template-dispatch.controller.ts
│       ├── dto/
│       │   ├── dispatch-template.dto.ts   # payload de entrada (class-validator)
│       │   └── dispatch-accepted.dto.ts   # payload de resposta (dispatchId)
│       ├── services/
│       │   └── template-dispatch.service.ts
│       ├── repositories/
│       │   ├── template.repository.ts     # interface
│       │   └── prisma-template.repository.ts
│       └── providers/
│           ├── dispatch-queue.provider.ts # interface do provider de fila
│           └── sqs-dispatch-queue.provider.ts # implementação @aws-sdk/client-sqs
├── prisma/
│   └── prisma.service.ts                  # PrismaClient encapsulado como provider injetável
├── app.module.ts
└── main.ts

test/
├── template-dispatch.e2e-spec.ts          # e2e: 202/400/404/422/timeout SQS
└── jest-e2e.json

src/modules/template-dispatch/services/
└── template-dispatch.service.spec.ts      # unit: regra de negócio isolada
```

**Structure Decision**: Projeto único NestJS (já inicializado em `src/`), seguindo a
estrutura modular por feature (`src/modules/template-dispatch/`) com as quatro camadas
exigidas pelo Princípio I: `controllers/` (HTTP + DTO), `services/` (regra de negócio),
`repositories/` (Prisma) e `providers/` (SQS). `PrismaService` fica em `src/prisma/` como
módulo de infraestrutura compartilhado, disponível para futuros repositories. Adicionalmente
(Fase 0, setup de ambiente), um `docker-compose.yml` na raiz do repositório sobe Postgres e
LocalStack (SQS) para desenvolvimento local reproduzível, sem impacto na estrutura de código
das Fases 1/2 já implementadas.

## Complexity Tracking

> Não aplicável — nenhuma violação de princípio identificada no Constitution Check.
