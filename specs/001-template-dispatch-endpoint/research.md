# Phase 0 Research: Endpoint de Disparo de Template

## 1. Persistência do Template

**Decision**: Prisma ORM com PostgreSQL, `TemplateRepository` como interface injetável e
`PrismaTemplateRepository` como implementação concreta usando `PrismaService`
(`PrismaClient` encapsulado em provider `OnModuleInit`/`OnModuleDestroy`).

**Rationale**: O usuário especificou Prisma explicitamente. PostgreSQL é o engine mais comum
em projetos NestJS + Prisma e não há indicação de outro banco já em uso no projeto. O
repository expõe apenas `findById(templateId): Promise<Template | null>`, mantendo a
interface mínima necessária para o service (Princípio I — service não conhece Prisma).

**Alternatives considered**:
- Acesso direto ao Prisma Client dentro do service — rejeitado por violar o Princípio I
  (camada de repository obrigatória).
- TypeORM — rejeitado por especificação explícita do usuário por Prisma.
- MySQL — sem indicação do usuário; PostgreSQL escolhido por ser o padrão mais comum em
  stacks Prisma/NestJS. Pode ser trocado em `schema.prisma` sem impacto na camada de
  repository.

## 2. Enfileiramento via AWS SQS

**Decision**: `@aws-sdk/client-sqs` encapsulado em `SqsDispatchQueueProvider`, implementando
uma interface `DispatchQueueProvider` com método `enqueue(message): Promise<void>`. O
provider usa `SendMessageCommand` com `abortSignal: AbortSignal.timeout(1000)` (timeout de
1s conforme FR-009) e propaga qualquer erro/timeout para o service, que trata como falha
fail-closed (disparo não aceito).

**Rationale**: O SDK v3 (`@aws-sdk/client-sqs`) suporta `abortSignal` por request, permitindo
implementar o timeout de 1s exigido pela constituição (Princípio IV) e pela clarificação da
spec sem lógica de timeout manual. Encapsular atrás de uma interface (`DispatchQueueProvider`)
mantém o service desacoplado do SDK da AWS, alinhado ao padrão de "providers de integração"
do Princípio I e à exigência de encapsulamento em provider dedicado da Stack Tecnológica.

**Alternatives considered**:
- BullMQ (mencionado como exemplo na constituição) — rejeitado porque o usuário especificou
  explicitamente AWS SQS.
- Chamar o SDK diretamente no service — rejeitado por violar Princípio I e a exigência de
  encapsulamento em provider dedicado.
- Retry automático antes de falhar — fora de escopo; a spec define fail-closed simples em 1s,
  sem menção a retries. Retry pode ser adicionado depois como melhoria, não é um requisito.

## 3. Validação de Payload

**Decision**: DTO `DispatchTemplateDto` com `class-validator`: `@IsString() @IsNotEmpty()`
para `templateId`, e `@Matches(/^\+?[1-9]\d{1,14}$/)` (formato E.164) para
`clientPhoneNumber`. `ValidationPipe` global (ou por rota) com `whitelist: true` e
`forbidNonWhitelisted: true`, retornando 400 no formato `{ code, message }` via um
`ExceptionFilter` compartilhado.

**Rationale**: Alinhado ao Princípio II da constituição (validação de entrada obrigatória via
`class-validator`) e à Assumption da spec de que os telefones seguem E.164.

**Alternatives considered**: Validação manual no controller — rejeitada, viola Princípio II.

## 4. Timeout e Comportamento de Falha (Integração Externa)

**Decision**: Timeout de 1000ms na chamada SQS, fail-closed: qualquer timeout/erro de
enfileiramento resulta em resposta de erro ao chamador (não em sucesso falso), sem retry
automático nesta fase. Já resolvido na clarificação da spec (Session 2026-07-15).

**Rationale**: Requisito explícito FR-009 e Princípio IV.

**Alternatives considered**: N/A — decisão já capturada na spec via `/speckit-clarify`.

## 5. Geração e Propagação do `dispatchId` (Correlation ID)

**Decision**: `dispatchId` gerado no service via `crypto.randomUUID()` (nativo do Node.js,
sem dependência extra) no início do processamento da requisição, antes da busca do template.
Passado explicitamente para o repository (nos logs) e para o provider de fila (como parte da
mensagem e dos logs), e retornado ao chamador apenas em caso de aceite (202).

**Rationale**: Atende ao Princípio VI (correlation id único, propagado por todas as camadas)
e à clarificação da spec de que o `dispatchId` deve ser retornado ao chamador.

**Alternatives considered**: `uuid` (pacote npm) — rejeitado por redundância; `crypto.randomUUID()`
já é nativo do Node 20+ usado pelo projeto.

## 6. Mascaramento de Telefones em Log

**Decision**: Função utilitária `maskPhoneNumber(phone: string): string` que preserva apenas
os últimos 4 dígitos (ex.: `****7777`), usada em todo `Logger.log`/`Logger.error` que
referencie `clientPhoneNumber` ou `whatsappPhoneNumber`.

**Rationale**: Exigência direta do Princípio VI.

**Alternatives considered**: Omitir o telefone completamente dos logs — rejeitado por reduzir
capacidade de troubleshooting; mascaramento parcial atende a ambos objetivos.

## 7. Configuração de Fila e Conexão via Variáveis de Ambiente

**Decision**: `@nestjs/config` (`ConfigModule.forRoot`) para carregar variáveis de ambiente:
`AWS_REGION`, `SQS_QUEUE_URL`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (opcionais — o SDK
usa a cadeia padrão de credenciais da AWS se ausentes), `DATABASE_URL` (Prisma). Um
`ConfigService` tipado (ou ao menos validado no boot) injeta essas variáveis no
`SqsDispatchQueueProvider` e no `PrismaService`.

**Rationale**: Requisito explícito do usuário ("Config de fila e conexão via variáveis de
ambiente"). `@nestjs/config` é o padrão idiomático do NestJS para isso e evita acesso direto
a `process.env` espalhado pelo código.

**Alternatives considered**: Acesso direto a `process.env` nos providers — rejeitado por
dificultar testes (mock de config) e validação centralizada.

## 8. Ambiente de Desenvolvimento Local (Docker Compose)

**Decision**: `docker-compose.yml` na raiz do repositório com dois serviços:
- `postgres`: imagem `postgres:16-alpine`, expõe `5432`, usada como storage do `Template`
  via Prisma (mesmo `DATABASE_URL` de `research.md#1`).
- `localstack`: imagem `localstack/localstack`, com `SERVICES=sqs` habilitado, expõe `4566`.
  Um script de init (`docker/localstack/init/01-create-queue.sh`, montado no diretório
  padrão de bootstrap do LocalStack `/etc/localstack/init/ready.d/`) roda `awslocal sqs
  create-queue --queue-name template-dispatch-queue` automaticamente no startup do
  container, garantindo que a fila já exista antes da app subir.

A app se conecta a esses serviços via variáveis de ambiente (arquivo `.env` local, baseado
em `.env.example`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/speckit?schema=public"
AWS_REGION="us-east-1"
SQS_QUEUE_URL="http://localhost:4566/000000000000/template-dispatch-queue"
AWS_ENDPOINT_URL="http://localhost:4566"   # override do endpoint do SDK p/ apontar ao LocalStack
AWS_ACCESS_KEY_ID="test"                    # credenciais dummy exigidas pelo SDK, LocalStack não valida
AWS_SECRET_ACCESS_KEY="test"
```

O `SqsDispatchQueueProvider` (já implementado nas Fases 1/2) lê `AWS_ENDPOINT_URL` via
`ConfigService` e, se presente, passa `endpoint: configService.get('AWS_ENDPOINT_URL')` ao
client `@aws-sdk/client-sqs` — mesmo client usado em produção, sem branch de código
condicional a ambiente (apenas configuração via env vars).

**Rationale**: Elimina a dependência de uma fila SQS real (dev/staging) ou de ElasticMQ
mencionada como alternativa em `quickstart.md`, permitindo que qualquer desenvolvedor suba um
ambiente completo (`docker compose up`) sem credenciais AWS reais. LocalStack é o padrão de
mercado para emular serviços AWS localmente e já resolve tanto SQS quanto a criação
automática de recursos via scripts de init, sem exigir infraestrutura adicional. Postgres em
container evita depender de uma instância local pré-instalada e mantém paridade de versão
com produção.

**Alternatives considered**:
- ElasticMQ (citado em `quickstart.md` original) — rejeitado como padrão do setup: emula
  apenas SQS (não outros serviços AWS que a feature possa vir a usar) e não oferece o mesmo
  mecanismo de bootstrap de recursos que o LocalStack; pode continuar sendo usado
  manualmente por quem preferir, mas não é o caminho documentado.
- Postgres/SQS "reais" (RDS/SQS de uma conta AWS de dev) para desenvolvimento local —
  rejeitado por exigir credenciais e conectividade externa, contrariando o objetivo de um
  ambiente local reproduzível e isolado.
- Criar a fila manualmente (via `awslocal` ou console) após o `docker compose up` — rejeitado
  por ser um passo manual e não reproduzível; a criação automática via script de init do
  LocalStack elimina esse atrito.

**Nota de escopo**: Este é um passo de setup de ambiente de desenvolvimento (Fase 0). Não
altera nenhum requisito funcional da spec, nem o código das Fases 1 e 2 já implementado — o
`SqsDispatchQueueProvider` e o `PrismaService` já suportam configuração via variáveis de
ambiente (`research.md#1` e `research.md#7`); o Docker Compose apenas fornece os serviços de
backend que essas variáveis apontam em ambiente local.

## Resumo de Unknowns Resolvidos

Todos os itens do Technical Context foram resolvidos nesta fase; nenhum "NEEDS
CLARIFICATION" remanescente.
