# Ativar gestão de usuários master

A interface administrativa já está no aplicativo. Para habilitar a criação e a edição de contas, conclua estas duas etapas no projeto Supabase.

## 1. Executar a migração SQL

1. Abra o projeto Supabase.
2. Acesse **SQL Editor → New query**.
3. Abra o arquivo `supabase-management-migration.sql` deste repositório.
4. Copie todo o conteúdo, cole no SQL Editor e clique em **Run**.

A migração adiciona `profiles.module_access`, que guarda as permissões de visualização por usuário.

## 2. Publicar a Edge Function segura

A criação de usuários e a alteração de e-mail/senha exigem a API administrativa do Supabase Auth. A chave `service_role` é usada somente no servidor e nunca deve ser colocada em `auth.js`, `app.js` ou em qualquer arquivo público.

Com o Supabase CLI instalado e autenticado, na raiz deste repositório execute:

```bash
supabase link --project-ref dndywuldnugkehqntcar
supabase functions deploy admin-users
```

A função usa as variáveis de ambiente padrão do projeto Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Testar

1. Atualize o aplicativo com Ctrl + F5.
2. Entre com uma conta master.
3. Abra **Gestão de pessoas → Criar usuário**.
4. Informe nome, e-mail, senha inicial e os módulos liberados.
5. Para editar uma conta, abra **Editar usuário e acessos**. Deixe a senha em branco para mantê-la.
6. Entre com a conta comum criada e confirme que somente os módulos habilitados aparecem.

## Observações de segurança

- A Edge Function valida o token da sessão e confirma o papel `master` no banco antes de executar operações administrativas.
- A senha nunca é armazenada na tabela `profiles`; ela é enviada diretamente à API administrativa do Supabase Auth.
- A criação confirma o e-mail automaticamente e não dispara convite de acesso.
- A alteração de e-mail também confirma o novo endereço e não envia e-mail de confirmação.
- A permissão de módulo controla a navegação e a visualização no aplicativo. Ela não substitui políticas RLS próprias para tabelas que venham a ser criadas no futuro.
