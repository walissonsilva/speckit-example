# Phase 1 Data Model: Endpoint de Disparo de Template

## Template (persistido — Prisma / PostgreSQL)

Representa uma mensagem pré-definida disponível para disparo. Cadastro e gestão (criação,
edição, texto) ocorrem fora do escopo desta feature; aqui apenas leitura por `templateId`.

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | `String` (cuid/uuid) | sim | Chave primária. Corresponde ao `templateId` recebido no payload. |
| `text` | `String` | sim | Texto da mensagem do template. Não validado/usado pelo endpoint de disparo além de existir. |
| `whatsappPhoneNumber` | `String` (E.164) | não (ver Edge Case) | Número de WhatsApp de origem pelo qual a mensagem é enviada ao cliente. Ausência é tratada como dado inconsistente → HTTP 422 (FR-010). |
| `createdAt` | `DateTime` | sim | Metadado de auditoria. |
| `updatedAt` | `DateTime` | sim | Metadado de auditoria. |

Esboço Prisma (`prisma/schema.prisma`):

```prisma
model Template {
  id                  String   @id @default(cuid())
  text                String
  whatsappPhoneNumber String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@map("templates")
}
```

`whatsappPhoneNumber` é opcional no schema para modelar explicitamente o edge case de dado
inconsistente (Assumption da spec: "sempre possui... a ausência é tratada como condição de
erro, não como caso comum" — nullable no banco, mas obrigatório para o disparo ser aceito).

## DispatchTemplateDto (entrada — não persistido)

Payload recebido no `POST`. Validado com `class-validator` antes de alcançar o service
(Princípio II).

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `templateId` | `string` | sim | `@IsString()`, `@IsNotEmpty()` |
| `clientPhoneNumber` | `string` | sim | `@IsString()`, `@Matches(/^\+?[1-9]\d{1,14}$/)` (E.164) |

## DispatchAcceptedDto (saída de sucesso — não persistido)

Retornado ao chamador com HTTP 202 quando o disparo é aceito.

| Campo | Tipo | Descrição |
|---|---|---|
| `dispatchId` | `string` (UUID) | Identificador único do disparo, correlação com logs internos (FR-011). |

## Mensagem de Fila (SQS — não persistida)

Corpo da mensagem enviada ao SQS via `SqsDispatchQueueProvider`. Não é uma entidade de banco;
existe apenas como payload JSON serializado no `SendMessageCommand`.

| Campo | Tipo | Origem |
|---|---|---|
| `dispatchId` | `string` (UUID) | Gerado pelo service (correlation id, Princípio VI). |
| `templateId` | `string` | Do payload de entrada, repassado. |
| `clientPhoneNumber` | `string` | Do payload de entrada, repassado. |
| `whatsappPhoneNumber` | `string` | Resolvido do `Template` encontrado. |

## ErrorResponseDto (saída de erro — não persistido)

Formato padronizado de erro (Princípio III), usado em todas as respostas 400/404/422.

| Campo | Tipo | Descrição |
|---|---|---|
| `code` | `string` | Código de erro estável (ex.: `TEMPLATE_NOT_FOUND`, `VALIDATION_ERROR`, `TEMPLATE_MISSING_WHATSAPP_NUMBER`, `QUEUE_UNAVAILABLE`). |
| `message` | `string` | Mensagem legível descrevendo o erro. |

## Relacionamentos e Transições de Estado

- `Template` é apenas lido, nunca criado/alterado por este endpoint.
- "Disparo" não é uma entidade persistida nesta feature — é uma mensagem efêmera enviada ao
  SQS; seu ciclo de vida pós-enfileiramento (processamento, entrega) é responsabilidade de um
  consumidor fora de escopo (ver Assumptions da spec).
- Não há máquina de estados no endpoint: cada requisição resulta em exatamente um dos
  seguintes desfechos, sem persistência de estado intermediário: 202 (aceito e enfileirado),
  400 (payload inválido), 404 (template inexistente), 422 (template sem `whatsappPhoneNumber`).
