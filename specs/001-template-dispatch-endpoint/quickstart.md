# Quickstart: Endpoint de Disparo de Template

Guia de validação end-to-end da feature. Para detalhes de schema e contrato, ver
[data-model.md](./data-model.md) e [contracts/template-dispatch.openapi.yaml](./contracts/template-dispatch.openapi.yaml).

## Pré-requisitos

- Node.js 20+ e dependências instaladas (`npm install`), incluindo as novas dependências da
  feature: `@prisma/client`, `prisma`, `@aws-sdk/client-sqs`, `@nestjs/config`.
- PostgreSQL acessível (local via Docker ou instância de dev) com `DATABASE_URL` configurada.
- Uma fila SQS real (dev/staging) ou um endpoint compatível (ex.: [ElasticMQ](https://github.com/softwaremill/elasticmq)
  local) para testar o enfileiramento sem depender da AWS real.

## Variáveis de Ambiente

```env
DATABASE_URL="postgresql://user:password@localhost:5432/speckit?schema=public"
AWS_REGION="us-east-1"
SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/000000000000/template-dispatch-queue"
# Opcionais — se ausentes, o SDK usa a cadeia padrão de credenciais da AWS
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
```

## Setup

```bash
npx prisma migrate dev --name add_template
npx prisma generate
npm run start:dev
```

## Cenário 1 — Disparo aceito (User Story 1, P1)

1. Insira um template de teste no banco (via `prisma studio` ou seed) com `id = "T1"` e
   `whatsappPhoneNumber = "5511999990000"`.
2. Envie a requisição:

   ```bash
   curl -i -X POST http://localhost:3000/template-dispatches \
     -H "Content-Type: application/json" \
     -d '{"templateId":"T1","clientPhoneNumber":"5511988887777"}'
   ```

3. **Esperado**: HTTP `202` com corpo `{ "dispatchId": "<uuid>" }`, respondido em menos de 1s
   (SC-001), sem aguardar o consumo da mensagem na fila.
4. Verifique na fila SQS (ou no console do ElasticMQ) que uma mensagem foi publicada contendo
   `dispatchId`, `templateId: "T1"`, `clientPhoneNumber: "5511988887777"` e
   `whatsappPhoneNumber: "5511999990000"` (SC-002).

## Cenário 2 — Template inexistente (User Story 2, P2)

```bash
curl -i -X POST http://localhost:3000/template-dispatches \
  -H "Content-Type: application/json" \
  -d '{"templateId":"T999","clientPhoneNumber":"5511988887777"}'
```

**Esperado**: HTTP `404` com `{ "code": "TEMPLATE_NOT_FOUND", "message": "..." }`; nenhuma
mensagem publicada na fila (SC-003).

## Cenário 3 — Payload inválido (User Story 3, P3)

```bash
# Sem templateId
curl -i -X POST http://localhost:3000/template-dispatches \
  -H "Content-Type: application/json" \
  -d '{"clientPhoneNumber":"5511988887777"}'

# clientPhoneNumber em formato inválido
curl -i -X POST http://localhost:3000/template-dispatches \
  -H "Content-Type: application/json" \
  -d '{"templateId":"T1","clientPhoneNumber":"abc123"}'
```

**Esperado**: HTTP `400` com `{ "code": "VALIDATION_ERROR", "message": "..." }` em ambos os
casos; nenhuma busca de template nem publicação na fila ocorre (SC-004).

## Cenário 4 — Template sem `whatsappPhoneNumber` (Edge Case)

1. Insira um template com `id = "T2"` e `whatsappPhoneNumber = null`.
2. Envie:

   ```bash
   curl -i -X POST http://localhost:3000/template-dispatches \
     -H "Content-Type: application/json" \
     -d '{"templateId":"T2","clientPhoneNumber":"5511988887777"}'
   ```

**Esperado**: HTTP `422` com `{ "code": "TEMPLATE_MISSING_WHATSAPP_NUMBER", "message": "..." }`;
nenhuma mensagem publicada na fila.

## Cenário 5 — Timeout/indisponibilidade do SQS (Edge Case, fail-closed)

1. Aponte `SQS_QUEUE_URL` para um endpoint inválido/indisponível, ou derrube o ElasticMQ local.
2. Repita o Cenário 1.

**Esperado**: HTTP `503` com `{ "code": "QUEUE_UNAVAILABLE", "message": "..." }` em até ~1s
(timeout configurado); a API não reporta sucesso falso.

## Testes Automatizados

```bash
npm run test         # unit — regra de negócio do TemplateDispatchService isolada de HTTP/fila
npm run test:e2e      # e2e (supertest) — cobre os 5 cenários acima
```
