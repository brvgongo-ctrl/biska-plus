# Biska+

Plataforma que liga clientes a profissionais verificados em Luanda (pintores, canalizadores, electricistas, empregadas domésticas, babás, explicadores e motoristas). Disponível como app Android/iOS e como site.

## Estrutura

```
apps/
  web/        Site e (futuro) painel admin · Next.js
  mobile/     App Android/iOS · Expo (React Native)
packages/
  shared/     Código partilhado: cores, categorias, zonas, formatação (Kz, telefone), textos em português
supabase/
  migrations/ Esquema da base de dados com regras de segurança (RLS)
  seed.sql    Categorias e zonas de Luanda
```

Tudo é escrito em **TypeScript**. A base de dados e a autenticação ficam no **Supabase**.

## O que já existe (Sprint 1)

- Login de clientes com Google, Apple, Facebook ou número de telefone (código por SMS), na web e na app.
- Base de dados com perfis, categorias, zonas, perfil profissional, documentos KYC e registo de auditoria.
- Regras de segurança testadas:
  - ninguém se torna admin sozinho;
  - um profissional não se aprova a si próprio;
  - documentos KYC só são vistos pelo dono e pelos admins;
  - o público só vê profissionais aprovados e o nome abreviado ("Maria L.").
- Fluxo de verificação: `submit_kyc()` exige consentimento (Lei n.º 22/11) e os documentos obrigatórios da categoria; `review_kyc()` é só para admins e fica registado em `audit_log`.

## O que já existe (Sprint 2)

- **Cadastro do profissional** (web em `/profissional` e na app): nome, categoria, experiência, preço por dia, descrição e zonas de trabalho; envio de documentos (câmara, galeria ou PDF) para o bucket privado; consentimento da Lei n.º 22/11; envio para verificação.
- Os documentos pedidos dependem da categoria (BI frente/verso e selfie sempre; registo criminal para quem trabalha em casas ou com crianças; carta de condução para motoristas).
- **Painel admin** (web em `/admin`): fila por estado, ficha do profissional com os documentos (links temporários de 10 min), aceitar/rejeitar cada documento com motivo, e decidir o cadastro: começar análise, pedir correcção, aprovar, rejeitar ou suspender. Só admins vêem o painel (os outros recebem 404).
- Regras na base de dados (`supabase/migrations/20261104000000_sprint2_pro_onboarding.sql`):
  - durante a análise o profissional não altera dados, zonas nem documentos;
  - depois de aprovado pode mudar descrição, preço e zonas, mas não o nome nem a categoria;
  - documentos rejeitados não contam e podem ser substituídos;
  - não se aprova com documentos rejeitados; pedir correcção ou rejeitar exige motivo, que o profissional vê;
  - cada decisão e cada consulta dos documentos por um admin fica em `audit_log`.
- Testes automáticos destas regras em `supabase/tests/` (`pnpm test:db`).

## O que já existe (Sprint 3)

- **Pesquisa** (web em `/pesquisa`, também na app): por categoria e zona, sem precisar de login. A frase da página inicial é lida por palavras-chave ("canalizador no Kilamba" → Canalizador · Kilamba); a leitura com IA fica para o Sprint 5.
- **Perfil público** (`/profissionais/<id>`): nome abreviado, categoria, selo "Verificado pela Biska+", experiência, preço por dia, zonas e descrição. Nunca mostra telefone, nome completo nem documentos. Suspensos ou em análise não aparecem.
- Migração `supabase/migrations/20261111000000_sprint3_public_search.sql`: a vista pública passa a incluir as zonas e a data da verificação.

## Pôr a funcionar

### 1. Requisitos

- Node.js 22 ou superior
- pnpm: `npm install -g pnpm`

```bash
pnpm install
```

### 2. Supabase

1. Cria um projecto gratuito em [supabase.com](https://supabase.com). Para menor latência a partir de Angola, escolhe a região **Europe (Frankfurt)** ou **South Africa** quando existir.
2. Em **SQL Editor**, corre por esta ordem o conteúdo de:
   1. `supabase/migrations/20261028000000_init.sql`
   2. `supabase/migrations/20261104000000_sprint2_pro_onboarding.sql`
   3. `supabase/migrations/20261111000000_sprint3_public_search.sql`
   4. `supabase/seed.sql`

   (Se já tinhas corrido os anteriores, basta correr os ficheiros novos.)
3. Em **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000` (depois, o domínio real)
   - **Redirect URLs:**
     - `http://localhost:3000/auth/callback`
     - `biskaplus://auth/callback`
     - `exp://**` (para testar com o Expo Go)
4. Em **Authentication → Providers**, activa:
   - **Phone:** precisa de um fornecedor de SMS (Twilio, Vonage, MessageBird…). Enquanto não houver, usa os *test phone numbers* do Supabase.
   - **Google, Apple e Facebook:** cada um pede um ID e uma chave criados na consola do respectivo fornecedor.
5. O URL e a chave pública do projecto já estão em `packages/shared/src/supabase-config.ts`. Para usar outro projecto (ex.: testes), cria `apps/web/.env.local` e `apps/mobile/.env.local` a partir dos `.env.example`.

Para confirmar a ligação e que as migrações estão aplicadas:

```bash
pnpm check:supabase
```

### 3. Correr

```bash
pnpm dev:web      # site em http://localhost:3000
pnpm dev:mobile   # app: lê o QR code com o Expo Go
```

### 4. Criar o primeiro administrador

Depois de entrares uma vez, corre no SQL Editor (troca o email):

```sql
update public.profiles
set roles = array_append(roles, 'admin')
where id = (select id from auth.users where email = 'teu-email@exemplo.com');
```

## Comandos úteis

| Comando | O que faz |
|---|---|
| `pnpm typecheck` | Verifica os tipos em todo o projecto |
| `pnpm lint` | Verifica o estilo do código |
| `pnpm build` | Compila o site para produção |
| `pnpm check:supabase` | Testa a ligação ao Supabase e se as migrações estão aplicadas |
| `pnpm test:db` | Corre os testes de segurança da base de dados num PostgreSQL local (`DATABASE_URL=…`) |

## Próximos sprints

2. ~~Cadastro do profissional com envio de documentos e painel admin de aprovação~~ ✓
3. ~~Pesquisa por categoria e localização, perfil público~~ ✓
4. Pedidos, orçamentos, chat e notificações
5. Avaliações, SOS, denúncias e IA (pedido em linguagem natural, leitura do BI)
6. Pagamentos (modo de teste), polimento e publicação beta
