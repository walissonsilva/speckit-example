# Feature Specification: Endpoint de Disparo de Template

**Feature Branch**: `001-template-dispatch-endpoint`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Endpoint de disparo de template. A API expõe um POST que recebe { templateId, clientPhoneNumber }. O payload deve ser validado. O templateId é buscado em um banco de dados. Cada template tem um texto e está associado a um número de WhatsApp (whatsappPhoneNumber) pelo qual será disparado ao cliente. Se o template existir, o disparo é aceito e enfileirado para processamento assíncrono, carregando templateId, clientPhoneNumber e o whatsappPhoneNumber do template. Se o template não existir, o disparo não acontece. O chamador da API não espera o envio efetivo ao cliente — apenas o aceite do disparo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Disparar template existente (Priority: P1)

Um sistema cliente solicita o disparo de um template de mensagem para um número de telefone informando o identificador do template e o telefone do destinatário. O template existe na base de dados, então o disparo é aceito imediatamente e colocado para processamento assíncrono, sem que o chamador precise aguardar o envio efetivo da mensagem ao cliente final.

**Why this priority**: É o fluxo principal de valor da feature — sem ele, a API não cumpre sua função de aceitar e encaminhar disparos de template.

**Independent Test**: Pode ser testado enviando um POST com um `templateId` válido e um `clientPhoneNumber` válido, e verificando que a API responde com aceite e que um item é enfileirado contendo `templateId`, `clientPhoneNumber` e o `whatsappPhoneNumber` do template.

**Acceptance Scenarios**:

1. **Given** um template com id `T1` existente na base, associado ao número `whatsappPhoneNumber` `5511999990000`, **When** é enviado um POST com `{ templateId: "T1", clientPhoneNumber: "5511988887777" }`, **Then** a API responde indicando aceite do disparo e um item é enfileirado com `templateId: "T1"`, `clientPhoneNumber: "5511988887777"` e `whatsappPhoneNumber: "5511999990000"`.
2. **Given** um disparo aceito e enfileirado, **When** a resposta da API é observada, **Then** a resposta ocorre sem aguardar a entrega efetiva da mensagem ao cliente (a API não bloqueia até o envio real).

---

### User Story 2 - Rejeitar disparo para template inexistente (Priority: P2)

Um sistema cliente solicita o disparo de um template informando um `templateId` que não existe na base de dados. O disparo não deve ocorrer nem ser enfileirado, e o chamador deve ser informado de que o template não foi encontrado.

**Why this priority**: Evita que disparos "fantasmas" sejam enfileirados sem um template válido, o que geraria falhas silenciosas no processamento assíncrono downstream.

**Independent Test**: Pode ser testado enviando um POST com um `templateId` que não exista na base e verificando que nenhum item é enfileirado e que a API responde informando a ausência do template.

**Acceptance Scenarios**:

1. **Given** nenhum template com id `T999` na base, **When** é enviado um POST com `{ templateId: "T999", clientPhoneNumber: "5511988887777" }`, **Then** a API responde informando que o template não existe e nenhum item é enfileirado.

---

### User Story 3 - Validar payload de entrada (Priority: P3)

Um sistema cliente envia um payload incompleto ou malformado (por exemplo, sem `templateId`, sem `clientPhoneNumber`, ou com `clientPhoneNumber` em formato inválido). A API deve rejeitar a requisição antes de tentar buscar o template.

**Why this priority**: Garante que dados inválidos nunca cheguem à etapa de busca do template ou de enfileiramento, protegendo a consistência dos dados processados downstream.

**Independent Test**: Pode ser testado enviando POSTs com payloads incompletos/malformados (campo ausente, tipo errado, telefone fora do formato esperado) e verificando que a API rejeita a requisição sem consultar a base de templates nem enfileirar nada.

**Acceptance Scenarios**:

1. **Given** um payload sem o campo `templateId`, **When** o POST é enviado, **Then** a API rejeita a requisição informando o campo obrigatório ausente, e nenhuma busca de template ou enfileiramento ocorre.
2. **Given** um payload com `clientPhoneNumber` em formato inválido (ex.: contém letras, ou não segue um padrão de telefone válido), **When** o POST é enviado, **Then** a API rejeita a requisição informando o formato inválido, e nenhuma busca de template ou enfileiramento ocorre.

---

### Edge Cases

- O que acontece se o `templateId` existir, mas o template não tiver um `whatsappPhoneNumber` associado (dado inconsistente)? A API deve tratar isso como uma condição de erro e não enfileirar um disparo incompleto.
- O que acontece se o mesmo par `templateId` + `clientPhoneNumber` for enviado múltiplas vezes em sequência? Cada requisição é tratada de forma independente, gerando um novo item enfileirado por padrão (sem deduplicação nesta fase).
- O que acontece se o serviço de enfileiramento estiver indisponível no momento do aceite? A API deve informar ao chamador que o disparo não pôde ser aceito, em vez de reportar sucesso falso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A API MUST expor uma operação para submissão de um disparo de template, recebendo `templateId` e `clientPhoneNumber` no payload.
- **FR-002**: A API MUST validar o payload de entrada antes de qualquer busca de template, rejeitando requisições com `templateId` ausente, `clientPhoneNumber` ausente, ou `clientPhoneNumber` em formato inválido.
- **FR-003**: A API MUST buscar o template correspondente ao `templateId` informado em uma base de dados de templates.
- **FR-004**: Quando o template existir, a API MUST aceitar o disparo e enfileirá-lo para processamento assíncrono, sem aguardar o envio efetivo da mensagem ao cliente.
- **FR-005**: O item enfileirado MUST conter o `templateId`, o `clientPhoneNumber` e o `whatsappPhoneNumber` associado ao template encontrado.
- **FR-006**: Quando o template não existir, a API MUST impedir que qualquer disparo seja enfileirado e MUST informar ao chamador que o disparo não ocorreu.
- **FR-007**: A API MUST responder ao chamador assim que o disparo for aceito ou rejeitado, sem aguardar a confirmação de entrega efetiva ao cliente final.
- **FR-008**: A API MUST tratar cada requisição de disparo de forma independente, sem deduplicar disparos repetidos para o mesmo `templateId` e `clientPhoneNumber`.

### Key Entities *(include if feature involves data)*

- **Template**: representa uma mensagem pré-definida disponível para disparo. Atributos principais: identificador (`templateId`), texto da mensagem, e o número de WhatsApp (`whatsappPhoneNumber`) pelo qual a mensagem é enviada ao cliente.
- **Disparo (item enfileirado)**: representa uma solicitação de envio aceita para processamento assíncrono. Atributos principais: `templateId`, `clientPhoneNumber` (destinatário) e `whatsappPhoneNumber` (número de origem, herdado do template).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O chamador recebe uma resposta de aceite ou rejeição do disparo em menos de 1 segundo, sem aguardar o envio efetivo da mensagem.
- **SC-002**: 100% dos disparos aceitos para templates existentes resultam em um item enfileirado contendo `templateId`, `clientPhoneNumber` e `whatsappPhoneNumber` completos e corretos.
- **SC-003**: 100% das requisições que referenciam um `templateId` inexistente resultam em nenhum item enfileirado e em uma resposta clara de que o disparo não ocorreu.
- **SC-004**: 100% das requisições com payload inválido ou incompleto são rejeitadas antes de qualquer busca na base de templates.

## Assumptions

- `clientPhoneNumber` e `whatsappPhoneNumber` seguem um formato padrão internacional de telefone (ex.: E.164).
- O envio efetivo da mensagem ao cliente é realizado por um processo consumidor da fila, fora do escopo deste endpoint.
- O cadastro e a gestão dos templates (criação, edição, texto) ocorrem em outro fluxo, fora do escopo desta feature.
- Não há necessidade de deduplicação ou limitação de taxa de disparos repetidos nesta fase.
- Um `templateId` existente sempre possui um `whatsappPhoneNumber` associado válido; a ausência desse dado é tratada como condição de erro, não como caso comum.
