---

description: "Task list for Endpoint de Disparo de Template"
---

# Tasks: Endpoint de Disparo de Template

**Input**: Design documents from `/specs/001-template-dispatch-endpoint/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/template-dispatch.openapi.yaml, quickstart.md

**Tests**: Mandatory per Constitution Principle V (e2e via supertest covering 202/400/404/422/timeout; unit test for service business rules). Included below.

**Organization**: Tasks are grouped by user story (US1 = P1, US2 = P2, US3 = P3) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to US1/US2/US3
- File paths are exact and relative to repository root

## Path Conventions

Single NestJS project. Feature code under `src/modules/template-dispatch/`, shared Prisma infra under `src/prisma/`, e2e tests under `test/`, unit tests co-located with source (`*.spec.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and scaffold Prisma so later phases can build on it.

- [X] T001 Install runtime dependencies: `npm install @prisma/client @aws-sdk/client-sqs @nestjs/config` and dev dependency `npm install -D prisma`
- [X] T002 Run `npx prisma init` (if not already present) and create `prisma/schema.prisma` with the `Template` model (`id`, `text`, `whatsappPhoneNumber` nullable, `createdAt`, `updatedAt`, `@@map("templates")`) per [data-model.md](./data-model.md)
- [X] T003 Add `.env` / `.env.example` entries for `DATABASE_URL`, `AWS_REGION`, `SQS_QUEUE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` per [quickstart.md](./quickstart.md)

**Checkpoint**: `npx prisma generate` runs cleanly and `PrismaClient` types include `Template`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure shared by all user stories — config module, Prisma provider, module skeleton, shared DTOs/errors. MUST complete before any user story phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Register `ConfigModule.forRoot({ isGlobal: true })` in `src/app.module.ts`, loading `DATABASE_URL`, `AWS_REGION`, `SQS_QUEUE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- [X] T005 Create `PrismaService` in `src/prisma/prisma.service.ts` (extends `PrismaClient`, implements `OnModuleInit`/`OnModuleDestroy`) and a `PrismaModule` in `src/prisma/prisma.module.ts` exporting it
- [X] T006 [P] Create `maskPhoneNumber(phone: string): string` utility in `src/common/utils/mask-phone-number.ts` (preserves only last 4 digits) per research.md §6
- [X] T007 [P] Create `ErrorResponseDto` in `src/common/dto/error-response.dto.ts` with `code` and `message` fields per [data-model.md](./data-model.md)
- [X] T008 Create `src/modules/template-dispatch/template-dispatch.module.ts` importing `PrismaModule`, declaring controller/service/repository/provider (empty skeleton, filled in later tasks), and register it in `src/app.module.ts`
- [X] T009 [P] Define `DispatchQueueProvider` interface (`enqueue(message): Promise<void>`) in `src/modules/template-dispatch/providers/dispatch-queue.provider.ts`
- [X] T010 [P] Define `TemplateRepository` interface (`findById(templateId: string): Promise<Template | null>`) in `src/modules/template-dispatch/repositories/template.repository.ts`

**Checkpoint**: Module compiles (`npm run build`), Prisma/Config wiring available for injection — user story implementation can now begin.

---

## Phase 3: User Story 1 - Disparar template existente (Priority: P1) 🎯 MVP

**Goal**: Accept a dispatch request for an existing template, enqueue it to SQS with `templateId`, `clientPhoneNumber`, `whatsappPhoneNumber`, and respond 202 with a `dispatchId`, without waiting for actual delivery.

**Independent Test**: POST with a valid `templateId` (existing, with `whatsappPhoneNumber`) and valid `clientPhoneNumber` → 202 response with `dispatchId`; queue provider receives message with all three fields.

### Tests for User Story 1 ⚠️ (write first, must fail before implementation)

- [ ] T011 [P] [US1] Unit test in `src/modules/template-dispatch/services/template-dispatch.service.spec.ts`: given a mocked `TemplateRepository` returning a template with `whatsappPhoneNumber`, and a mocked `DispatchQueueProvider`, calling the service returns a `dispatchId` and the queue provider is called once with `{ dispatchId, templateId, clientPhoneNumber, whatsappPhoneNumber }`
- [ ] T012 [P] [US1] E2e test in `test/template-dispatch.e2e-spec.ts`: POST `/template-dispatches` with valid payload against a seeded/mocked existing template → expect `202` and body `{ dispatchId: <uuid> }` (Cenário 1 of [quickstart.md](./quickstart.md))

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create `DispatchTemplateDto` in `src/modules/template-dispatch/dto/dispatch-template.dto.ts` with `templateId` (`@IsString() @IsNotEmpty()`) and `clientPhoneNumber` (`@IsString() @Matches(/^\+?[1-9]\d{1,14}$/)`) per [data-model.md](./data-model.md)
- [ ] T014 [P] [US1] Create `DispatchAcceptedDto` in `src/modules/template-dispatch/dto/dispatch-accepted.dto.ts` with `dispatchId: string`
- [ ] T015 [US1] Implement `PrismaTemplateRepository` in `src/modules/template-dispatch/repositories/prisma-template.repository.ts` implementing `TemplateRepository.findById` via `PrismaService` (depends on T005, T010)
- [ ] T016 [US1] Implement `SqsDispatchQueueProvider` in `src/modules/template-dispatch/providers/sqs-dispatch-queue.provider.ts` implementing `DispatchQueueProvider.enqueue` using `@aws-sdk/client-sqs` `SendMessageCommand` with `abortSignal: AbortSignal.timeout(1000)`, reading `SQS_QUEUE_URL`/`AWS_REGION` from `ConfigService` (depends on T004, T009)
- [ ] T017 [US1] Implement `TemplateDispatchService` in `src/modules/template-dispatch/services/template-dispatch.service.ts`: generate `dispatchId` via `crypto.randomUUID()`, call `TemplateRepository.findById`, if found and has `whatsappPhoneNumber` call `DispatchQueueProvider.enqueue`, return `dispatchId`; log start/end with masked phone numbers using T006 utility (depends on T006, T009, T010)
- [ ] T018 [US1] Implement `TemplateDispatchController` in `src/modules/template-dispatch/controllers/template-dispatch.controller.ts`: `POST /template-dispatches` accepting `DispatchTemplateDto`, calling service, returning `202` with `DispatchAcceptedDto` (depends on T013, T014, T017)
- [ ] T019 [US1] Wire `PrismaTemplateRepository` and `SqsDispatchQueueProvider` as the injected implementations for `TemplateRepository`/`DispatchQueueProvider` tokens in `src/modules/template-dispatch/template-dispatch.module.ts` (depends on T008, T015, T016)

**Checkpoint**: User Story 1 fully functional — `npm run test` and `npm run test:e2e` pass for the accepted-dispatch scenario.

---

## Phase 4: User Story 2 - Rejeitar disparo para template inexistente (Priority: P2)

**Goal**: When `templateId` does not exist, respond `404 TEMPLATE_NOT_FOUND` and enqueue nothing.

**Independent Test**: POST with a non-existent `templateId` → 404 with `{ code: "TEMPLATE_NOT_FOUND", message }`; queue provider never called.

### Tests for User Story 2 ⚠️

- [ ] T020 [P] [US2] Unit test in `src/modules/template-dispatch/services/template-dispatch.service.spec.ts`: given `TemplateRepository.findById` resolves `null`, service throws/returns a not-found result and `DispatchQueueProvider.enqueue` is never called
- [ ] T021 [P] [US2] E2e test in `test/template-dispatch.e2e-spec.ts`: POST with `templateId: "T999"` (non-existent) → expect `404` and body `{ code: "TEMPLATE_NOT_FOUND", message }` (Cenário 2 of quickstart.md)

### Implementation for User Story 2

- [ ] T022 [US2] Add `TemplateNotFoundException` (extends `NotFoundException`, HTTP 404, code `TEMPLATE_NOT_FOUND`) in `src/modules/template-dispatch/exceptions/template-not-found.exception.ts`
- [ ] T023 [US2] Update `TemplateDispatchService` in `src/modules/template-dispatch/services/template-dispatch.service.ts` to throw `TemplateNotFoundException` when `findById` returns `null`, before any enqueue attempt (depends on T017, T022)
- [ ] T024 [US2] Add/verify global exception filter mapping thrown exceptions to `{ code, message }` body in `src/common/filters/http-exception.filter.ts`, register it in `src/main.ts`

**Checkpoint**: User Stories 1 AND 2 both pass their tests independently.

---

## Phase 5: User Story 3 - Validar payload de entrada (Priority: P3)

**Goal**: Reject malformed/incomplete payloads with `400 VALIDATION_ERROR` before any template lookup.

**Independent Test**: POST with missing `templateId` or malformed `clientPhoneNumber` → 400 with `{ code: "VALIDATION_ERROR", message }`; no repository/queue calls happen.

### Tests for User Story 3 ⚠️

- [ ] T025 [P] [US3] E2e test in `test/template-dispatch.e2e-spec.ts`: POST without `templateId` → expect `400` and body `{ code: "VALIDATION_ERROR", message }` (Cenário 3a of quickstart.md)
- [ ] T026 [P] [US3] E2e test in `test/template-dispatch.e2e-spec.ts`: POST with malformed `clientPhoneNumber` (e.g. `"abc123"`) → expect `400` and body `{ code: "VALIDATION_ERROR", message }` (Cenário 3b of quickstart.md)

### Implementation for User Story 3

- [ ] T027 [US3] Register global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` in `src/main.ts`
- [ ] T028 [US3] Add a custom exception factory / filter mapping `ValidationPipe` errors to `{ code: "VALIDATION_ERROR", message }` in `src/common/filters/http-exception.filter.ts` (depends on T024, T027)

**Checkpoint**: All three user stories independently functional and tested.

---

## Phase 6: Edge Cases — Consistency Checks (Cross-Cutting)

**Purpose**: Cover the two edge cases from spec.md not tied to a single priority story: missing `whatsappPhoneNumber` (422) and SQS timeout/unavailability (503, fail-closed).

- [ ] T029 [P] E2e test in `test/template-dispatch.e2e-spec.ts`: POST for a template that exists but has no `whatsappPhoneNumber` → expect `422` and body `{ code: "TEMPLATE_MISSING_WHATSAPP_NUMBER", message }`, no message enqueued (Cenário 4 of quickstart.md)
- [ ] T030 [P] E2e test in `test/template-dispatch.e2e-spec.ts`: POST when the queue provider mock times out/rejects within 1s → expect `503` and body `{ code: "QUEUE_UNAVAILABLE", message }` (Cenário 5 of quickstart.md)
- [ ] T031 Add `TemplateMissingWhatsappNumberException` (422) and `QueueUnavailableException` (503) in `src/modules/template-dispatch/exceptions/`, mapped to `TEMPLATE_MISSING_WHATSAPP_NUMBER` and `QUEUE_UNAVAILABLE` codes respectively
- [ ] T032 Update `TemplateDispatchService` in `src/modules/template-dispatch/services/template-dispatch.service.ts` to throw `TemplateMissingWhatsappNumberException` when the found template lacks `whatsappPhoneNumber`, and to catch/convert `DispatchQueueProvider.enqueue` timeout/errors into `QueueUnavailableException` (fail-closed, depends on T017, T031)

**Checkpoint**: All FR-009/FR-010 edge cases from spec.md are covered by tests and implementation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup applying across all stories.

- [ ] T033 [P] Run `npx prisma migrate dev --name add_template` and `npx prisma generate` to confirm schema/migration validity
- [ ] T034 Run full `npm run test` and `npm run test:e2e` suites and confirm all scenarios from [quickstart.md](./quickstart.md) pass
- [ ] T035 [P] Run `npm run lint` and `npm run format` and fix any violations across touched files
- [ ] T036 Manually execute all 5 quickstart.md scenarios against a running `npm run start:dev` instance (with DB + ElasticMQ/SQS) to confirm SC-001..SC-004

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion; extends the service built in US1 (T017), so implement after Phase 3 in practice even though independently testable
- **User Story 3 (Phase 5)**: Depends on Foundational completion; independent of US1/US2 service logic (only touches DTO validation + global pipe/filter)
- **Edge Cases (Phase 6)**: Depends on US1's service (T017) and US2's exception/filter pattern (T022, T024)
- **Polish (Phase 7)**: Depends on all prior phases

### Within Each User Story

- Tests written first, confirmed failing, then implementation
- DTOs/interfaces before services; services before controllers
- Repository/provider implementations before module wiring

### Parallel Opportunities

- T001–T003 (Setup) can mostly run sequentially (same `package.json`/`schema.prisma`); T003 [P] with T002 possible if care taken with file conflicts
- T006, T007, T009, T010 (Phase 2) marked [P] — different files, no shared dependency
- T011, T012 (US1 tests) in parallel; T013, T014 (US1 DTOs) in parallel
- T020, T021 (US2 tests) in parallel
- T025, T026 (US3 tests) in parallel
- T029, T030 (edge case tests) in parallel

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together:
Task: "Unit test in src/modules/template-dispatch/services/template-dispatch.service.spec.ts"
Task: "E2e test in test/template-dispatch.e2e-spec.ts (Cenário 1)"

# Launch US1 DTOs together:
Task: "Create DispatchTemplateDto in src/modules/template-dispatch/dto/dispatch-template.dto.ts"
Task: "Create DispatchAcceptedDto in src/modules/template-dispatch/dto/dispatch-accepted.dto.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run Cenário 1 from quickstart.md, confirm 202 + enqueued message
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → test independently → MVP demo
3. Add User Story 2 → test independently → demo
4. Add User Story 3 → test independently → demo
5. Add Edge Cases (422/503) → test independently → demo
6. Polish phase → full quickstart.md validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests are mandatory here (Constitution Principle V), not optional — write and confirm failing before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
