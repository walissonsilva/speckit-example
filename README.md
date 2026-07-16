# 🌱 SpecKit Flow Exercise

Serviço em NestJS responsável por receber pedidos de despacho de templates de mensagem do WhatsApp, validar o template contra a base de dados e enfileirar o envio de forma assíncrona via AWS SQS.

O chamador não aguarda a entrega efetiva da mensagem — apenas a confirmação de que o pedido foi aceito ou rejeitado.

## Funcionalidades

### `POST /template-dispatches`

Recebe `{ templateId, clientPhoneNumber }`, valida o template no Postgres e publica o pedido na fila SQS.

- **202 Accepted** — pedido aceito, retorna um `dispatchId` único.
- **404 Not Found** (`TEMPLATE_NOT_FOUND`) — o `templateId` informado não existe.
- **422 Unprocessable Entity** (`TEMPLATE_MISSING_WHATSAPP_NUMBER`) — o template existe, mas não possui um número de WhatsApp configurado.
- **503 Service Unavailable** (`QUEUE_UNAVAILABLE`) — a fila não confirmou o enfileiramento dentro do timeout de 1s; falha de forma fail-closed, nunca reportando sucesso indevido.

### `GET /health`

Healthcheck simples, retorna `{ status: 'OK' }`.

## Stack técnica

- [NestJS](https://nestjs.com/) 11 (TypeScript) sobre Express
- [Prisma](https://www.prisma.io/) 7 + PostgreSQL
- AWS SQS (`@aws-sdk/client-sqs`), com [LocalStack](https://localstack.cloud/) para desenvolvimento local
- `class-validator` / `class-transformer` para validação de payloads
- Jest + Supertest para testes unitários e e2e

## Pré-requisitos

- Node.js
- Docker e Docker Compose

## Configuração do projeto

```bash
$ npm install
```

Copie o arquivo de variáveis de ambiente de exemplo e ajuste se necessário:

```bash
$ cp .env.example .env
```

Principais variáveis (ver `.env.example`):

- `DATABASE_URL` — string de conexão do Postgres
- `AWS_REGION`, `SQS_QUEUE_URL` — configuração da fila SQS
- `AWS_ENDPOINT_URL` — aponta o SDK da AWS para o LocalStack em desenvolvimento local
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — credenciais dummy usadas com o LocalStack

Suba a infraestrutura local (Postgres em `localhost:5432` e LocalStack/SQS em `localhost:4566`, com a fila `template-dispatch-queue` já criada):

```bash
$ docker compose up -d
```

Execute as migrations do Prisma:

```bash
$ npx prisma migrate dev --name add_template
$ npx prisma generate
```

## Rodando o projeto

```bash
# desenvolvimento
$ npm run start

# modo watch
$ npm run start:dev

# produção
$ npm run start:prod
```

## Testes

```bash
# testes unitários
$ npm run test

# testes e2e
$ npm run test:e2e

# cobertura de testes
$ npm run test:cov
```

## Documentação adicional

Este projeto segue o workflow [spec-kit](https://github.com/github/spec-kit). A especificação detalhada da funcionalidade, plano técnico, modelo de dados e contrato OpenAPI da API estão em [`specs/001-template-dispatch-endpoint/`](specs/001-template-dispatch-endpoint/):

- `spec.md` — especificação funcional
- `plan.md` — plano de implementação
- `data-model.md` — modelo de dados
- `contracts/template-dispatch.openapi.yaml` — contrato OpenAPI do endpoint

## Licença

Este projeto é privado e não possui licença (`UNLICENSED`).
