# ByaFlux — base inicial

Mod de plugins para o aplicativo oficial do Discord. Baseado no Equicord, com seu instalador Equilotl. Não é um cliente separado.

## Incluído

- Seção ByaFlux nas configurações, com ícone próprio.
- Plugins do Equicord e Vencord preservados, sujeitos à compatibilidade da base com o Discord.
- Plugin próprio de exemplo `ByaFluxInfo`, identificado com o ícone do projeto.
- **ByaBadges** obrigatório e ativo por padrão: lê definições, imagens e atribuições de um repositório público separado.
- Sem catálogo incluído no mod; mantém apenas a URL da fonte e o cache remoto.
- Instalador gráfico e CLI derivados do Equilotl; instala, repara e remove o mod.
- Atualizador consulta apenas o repositório configurado do projeto.
- Aviso ao iniciar o Discord e verificações a cada 30 minutos, com acesso ao botão **Atualizar e reiniciar**. Atualização automática desativada por padrão.
- Publicação conjunta do mod e dos instaladores no GitHub Actions, evitando releases parciais.

## Publicar a primeira versão

1. Instale Git e Node.js 24.
2. Crie no seu GitHub um repositório público vazio chamado `ByaFlux`.
3. Extraia este projeto e, no terminal da pasta que contém este README, execute (substitua `SEU_USUARIO`):

```powershell
node scripts/configure.mjs --repo SEU_USUARIO/ByaFlux
git init -b main
git add .
git commit -m "Base inicial do ByaFlux"
git remote add origin https://github.com/SEU_USUARIO/ByaFlux.git
git push -u origin main
git tag v0.0.5
git push origin v0.0.5
```

4. Aguarde o workflow **Publicar ByaFlux** em **Actions** terminar.
5. Em **Releases**, baixe e distribua `ByaFluxInstaller.exe`.

O workflow configura automaticamente o repositório a partir de `GITHUB_REPOSITORY`. Não é necessário token pessoal: usa a credencial temporária padrão do Actions. O código e as licenças das bases acompanham a distribuição. Esta primeira configuração gera instaladores para **Windows x64**.

## Próximas atualizações

Após alterar seus arquivos, atualize `version` nos arquivos `package.json` e `mod/package.json` para a versão que será publicada (por exemplo, `0.0.6`). Depois:

```powershell
git add .
git commit -m "Novos plugins e melhorias"
git push origin main
git tag v0.0.6
git push origin v0.0.6
```

Use uma tag nova por versão. Somente a release completa é publicada. O título precisa terminar com o hash completo do commit: o workflow faz isso automaticamente. Não edite esse trecho do título.

Ao abrir o Discord, o usuário recebe um aviso com o botão **Atualizar e reiniciar**. Um clique baixa e aplica a atualização e reinicia o Discord, sem uma segunda confirmação. O mesmo botão existe na tela Updater. Se o download falhar, o Discord não é reiniciado. Não é necessário executar o instalador a cada versão.

## Plugins próprios e userplugins

| Categoria | Pasta | Estrutura |
| --- | --- | --- |
| Próprios do ByaFlux | `mod/src/byafluxplugins/` | `NomeDoPlugin/index.ts` ou `index.tsx` |
| Plugins externos do usuário | `mod/src/userplugins/` | `NomeDoPlugin/index.ts` ou `index.tsx` |
| Base Equicord | `mod/src/equicordplugins/` | Estrutura original preservada |
| Base Vencord | `mod/src/plugins/` | Estrutura original preservada |

A pasta `mod/src/byafluxplugins/byaFluxInfo/` contém o exemplo do projeto. O carregamento usa `definePlugin`, com as mesmas APIs, dependências, configurações, patches, arquivos `native.ts` e sufixos de plataforma da base Equicord. O alias `@byafluxplugins/` pode ser usado em imports internos. As subpastas `_api` e `_core` também são carregadas.

O selo e o filtro **Show ByaFlux** reconhecem automaticamente qualquer plugin dentro de `byafluxplugins`. Não há lista de nomes para cadastrar. Plugins externos em `userplugins` mantêm o selo e o filtro de userplugin.

### Instalar userplugins

Na instalação local com código-fonte, o plugin **UserpluginInstaller** fica disponível na lista de plugins mesmo ao usar `pnpm build`. Ative-o e abra a seção **UserPlugins** nas configurações. Cole o endereço do repositório do plugin e siga o processo de instalação. É necessário ter **Git**, **Node.js** e **pnpm** no PATH.

O instalador grava apenas em `mod/src/userplugins/` e recompila usando o comando da raiz, inclusive quando o ByaFlux foi extraído de um ZIP sem Git. Quando solicitado, reinicie o Discord para carregar a nova versão.

Também é possível instalar manualmente: coloque a pasta do plugin em `mod/src/userplugins/`, feche o Discord, execute `pnpm build` na raiz e reabra o Discord.

O instalador de userplugins depende do código-fonte e das ferramentas de compilação. Não é incluído na distribuição standalone do workflow. Os plugins próprios já compilados continuam funcionando nessa distribuição.

## Instalar localmente como desenvolvedor

Requisitos: Node.js 24 ou superior e pnpm. Feche completamente o Discord.
Extraia o ZIP, abra o terminal na pasta que contém este README e execute:

```powershell
pnpm install
pnpm build
pnpm inject
```

Escolha sua instalação do Discord no menu do CLI e depois abra o Discord.
Não precisa configurar repositório, publicar releases, instalar Go, inicializar Git ou definir variáveis de ambiente para esse fluxo.

`pnpm install` instala as dependências do mod. `pnpm build` compila o código local.
`pnpm inject` baixa automaticamente o CLI oficial do Equilotl e o executa apontando para sua compilação ByaFlux. Ele funciona como ferramenta de desenvolvimento; o código carregado no Discord vem de `mod/dist/desktop`. Não substitui seu código pela versão pública do Equicord.

O CLI é obtido pela internet no primeiro uso. O Discord carregará os arquivos compilados dentro da pasta `mod`. Não mova ou apague a pasta enquanto estiver usando a instalação local. As preferências do mod usam a pasta de dados ByaFlux do sistema.

Para atualizar suas alterações, feche o Discord, rode `pnpm build` novamente e reabra o Discord. O atualizador de releases fica desativado nessa compilação local; a publicação pelo workflow continua gerando versões standalone com o atualizador próprio.

Para remover a instalação local:

```powershell
pnpm uninject
```

Para reparar: `pnpm repair`. Para escolher diretamente o Discord Stable: `pnpm inject --branch stable`.

Para validar o código:

```powershell
pnpm test
pnpm typecheck
```

A compilação para distribuição continua sendo feita pelo workflow descrito acima. Os comandos internos de `mod/package.json` permanecem disponíveis.

## Estrutura

- `package.json`: comandos `install`, `build`, `inject`, `uninject` e `repair` na raiz.
- `scripts/dev.mjs`: preparação e compilação local, inclusive ao extrair o ZIP sem Git.
- `mod/`: código completo do mod.
- `installer/`: código completo do instalador.
- `.github/workflows/release.yml`: compilação e publicação.
- `brand.json`: repositório da sua distribuição.
- `scripts/configure.mjs`: configura o destino das atualizações.
- `tests/updater.test.mjs`: valida seleção de versão e origem do download.
- `assets/byaflux.png`: logo oficial fornecida.
- `UPSTREAM.json`: commits de origem das bases.

## Estado da entrega

Compilação e checagem TypeScript do mod, trinta e três testes de atualização com reinício, backups, atualização do perfil, carregamento, ordem das badges e catálogo, atribuições, comandos de badges, separação de plugins, atualização, execução do pnpm e integração do CLI, e checagem do instalador CLI executados no ambiente de desenvolvimento. O ZIP foi extraído em uma pasta nova sem Git, e os comandos pnpm install, pnpm build e pnpm typecheck foram verificados nessa cópia. O fluxo de desenvolvimento foi verificado sem aplicar alterações a uma instalação real do Discord. A compilação gráfica local ficou bloqueada pela falta das bibliotecas X11/OpenGL neste ambiente Linux. O pipeline Windows precisa rodar no seu GitHub; instalação real e atualização entre duas versões precisam ser verificadas no Discord para Windows antes da distribuição pública. Nenhum repositório ou release foi publicado por esta entrega.

A marca das telas, menus, logs e informações do cliente foi ajustada para ByaFlux. Créditos, nomes de plugins, APIs, marcadores de instalação, variáveis de ambiente e serviços de terceiros mantêm suas referências de origem para preservar a compatibilidade.

## Personalização desta versão

- O filtro **Show ByaFlux** aparece logo abaixo de **Show Disabled** e lista automaticamente os plugins da pasta `mod/src/byafluxplugins/`.
- O cartão **Apoie o projeto** usa a logo fornecida, embutida na compilação e disponível também em `assets/byaflux.png`.
- Os botões **Doar** e **Discord** usam os destinos definidos em `mod/src/shared/byafluxSupport.ts`. Preencha `BYAFLUX_DONATE_URL` e `BYAFLUX_DISCORD_URL` com os links do seu projeto e rode `pnpm build`. Enquanto não configurados, os botões informam que os links estão indisponíveis; não enviam usuários para doações ou servidores de outra equipe.

## Créditos e licença

Base mod: https://github.com/Equicord/Equicord

Base instalador: https://github.com/Equicord/Equilotl

Base original: https://github.com/Vendicated/Vencord

Licenças originais preservadas em `mod/LICENSE` e `installer/LICENSE`. As alterações são distribuídas sob as respectivas licenças GPL das bases. Mantenha os créditos e disponibilize o código correspondente ao distribuir executáveis.

## Configurar ByaBadges

As definições, imagens e atribuições agora ficam no repositório **ByaBadges**, entregue separadamente. O código do mod não inclui catálogo de reserva, usuários ou imagens de badges.

Após subir o repositório público de badges, configure a URL do JSON na raiz do ByaFlux:

```powershell
pnpm badges:source "https://raw.githubusercontent.com/SEU_USUARIO/byabadges/main/badges.json"
pnpm build
```

A URL também pode ser definida em `brand.json`, no campo `badgesUrl`. Distribua essa compilação uma vez. Depois disso, novas badges, imagens e atribuições são gerenciadas apenas no GitHub; não exigem recompilar o mod.

O plugin consulta o catálogo ao iniciar e a cada cinco minutos. Reabra o perfil após atualizar. Se a fonte falhar, usa o último catálogo válido recebido dessa mesma URL. Sem fonte configurada, ou sem rede e sem cache na primeira execução, não mostra badges ByaFlux. O cache é local e inevitável para funcionar offline; ele não faz parte do código-fonte ou da compilação distribuída.

Os comandos antigos `pnpm badges create/grant/revoke` foram retirados do mod. O gerenciamento fica no repositório das badges. Esta entrega não publicou nenhum repositório nem configurou uma URL fictícia.

Fonte de badges configurada nesta entrega: `https://raw.githubusercontent.com/ByaFlux/byabadges/main/badges.json`. O catálogo e as imagens foram consultados com sucesso; os dados permanecem apenas no repositório de badges e no cache de cada cliente.

As badges ByaFlux são inseridas na mesma lista de badges do perfil, antes das oficiais do Discord e dos demais grupos de badges de mods. A ordem entre badges ByaFlux segue a lista do usuário no catálogo remoto.

Se as badges não aparecerem, abra as informações de **ByaBadges** na lista de plugins. A tela mostra **Sincronização**, **Seu ID** e **Suas badges**. Use **Atualizar badges** e confira se o ID exibido é o mesmo cadastrado no GitHub. Esta versão atualiza a lista do perfil após a chegada do catálogo e remove versões antigas de badges presentes em dados de perfil em cache.

## Backups e navegação

O botão Cloud foi retirado da seção de configurações do ByaFlux, junto com seu atalho de navegação. Os arquivos exportados usam o padrão `ByaFlux-TIPO-backup-AAAA-MM-DD.json`.

A tela Backup & Restore aceita backups JSON do ByaFlux, Vencord e Equicord, sem depender do nome do arquivo. São suportados o pacote de configurações com QuickCSS, os dados DataStore presentes nos backups Equicord e arquivos antigos de configurações que contêm `plugins`. O CSS vazio também pode ser restaurado. Plugins que não existem no ByaFlux não são instalados pelo backup. Reinicie o Discord após importar para aplicar as configurações.

Versão desta entrega: **ByaFlux 0.0.5**. O banner de desenvolvimento usa a identidade ByaFlux e atualiza automaticamente o formato padrão antigo do Equicord, inclusive quando ele já estava salvo nas configurações.

## Ativar atualizações para os usuários

O repositório do **código do mod** precisa ser público e estar configurado em `brand.json`, no campo `repository`. Ele é separado do repositório de badges. O workflow já configura o destino usando o próprio repositório em que roda.

A primeira instalação deve ser feita com `ByaFluxInstaller.exe` ou `ByaFluxInstallerCli.exe` baixados da sua release. Esses instaladores usam o `desktop.asar` standalone, com o atualizador habilitado. O CLI de desenvolvedor (`pnpm inject`) carrega `mod/dist/desktop`, cuja compilação local mantém o atualizador desativado para preservar alterações locais.

Para publicar atualizações, envie uma nova tag `vVERSAO`; o workflow compila e publica a release completa. Não renomeie o título gerado pelo workflow: o hash no final identifica a versão instalada. Enviar apenas um commit para `main` não publica uma atualização para os clientes.

Esta entrega preparou o botão de atualização e o pipeline, mas ainda não publicou o repositório do código ou uma primeira release. O teste completo de atualização entre duas versões no Discord para Windows depende dessas publicações.
