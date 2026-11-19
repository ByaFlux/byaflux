# ByaFlux Mobile 0.1.0-preview.1

Prévia Android baseada no Valenced 1.3.0. Requer Android 9 ou superior e internet para baixar o Discord compatível.

## Instalar

1. Instale o APK ByaFluxMobile. Ele é o instalador.
2. Abra o aplicativo e toque em Install.
3. Autorize a instalação do aplicativo ByaFlux quando o Android solicitar.
4. Abra o ByaFlux instalado e entre na sua conta.
5. Acesse Configurações, ByaFlux, Plugins.

O aplicativo modificado usa o pacote app.byaflux.mobile e instala separadamente do Discord oficial. Não instale o carregador interno como se fosse o Discord.

## Plugins

- ByaBadges é obrigatório. Carrega o catálogo oficial a cada cinco minutos e mantém o último catálogo válido offline. As três imagens SVG atuais estão incluídas como PNG para o Android.
- FakeBadges vem desligado. Ative-o e abra suas opções. Toque em Usar minha conta ou informe um ID. Escolha badges, níveis de Nitro e boost. As alterações são apenas locais. Nitro e boost selecionados substituem a badge correspondente do Discord. Subir e Descer mudam a ordem das badges comuns selecionadas.
- AlwaysExtended vem ligado. Remove o limite de badges quando a versão compatível do Discord expõe essa opção e permite a quebra de linha.

Os plugins de computador do Vencord e Equicord precisam de adaptação. Plugins mobile compatíveis com a API do Valenced podem ser instalados pela área de plugins da base.

## Estado da prévia

A compilação do bundle, a checagem de tipos e os testes automatizados verificam o código. A interface e as chamadas precisam de validação em um aparelho Android real. A tela do ByaBadges mostra quantas integrações de perfil foram detectadas. Zero após abrir um perfil indica incompatibilidade que precisa de correção.

Esta prévia não tem atualizador próprio do instalador. Não atualiza para o Valenced original. A assinatura de desenvolvimento não é uma chave de distribuição permanente. Para publicar atualizações estáveis, configure e preserve sua própria chave de assinatura.

O carregador nativo e os patches usam a release 1.3.0 do Valenced. A compilação substitui apenas o bundle e o manifesto dos plugins, verifica os arquivos originais por SHA-256 e assina novamente o carregador. Os identificadores internos valenced permanecem por compatibilidade.

## Código e compilação

Este ramo contém os arquivos alterados em overlay e fixa os commits originais em base-lock.json. O script scripts/prepare.py baixa os dois projetos e aplica as alterações. O workflow mobile-preview.yml compila o APK. Ele não publica uma release nem altera o ramo main.

Base: https://github.com/Valenced/valenced e https://github.com/Valenced/valenced-manager. As licenças originais continuam nos projetos preparados. Os plugins do ByaFlux exibem Haru, ID 1227436212982251533, como autor. Créditos da base e dos arquivos reaproveitados foram preservados.
